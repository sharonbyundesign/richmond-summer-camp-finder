-- 003 · camp_updates: extracted changes wait here until a human publishes them.
--
-- Requires: 001 (trust fields) and 002 (camp_sources, referenced by source_id).
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT; safe to re-run.
-- Rollback: 003_camp_updates.down.sql.
--
-- ONE TABLE FOR BOTH TARGETS: a proposed change to a camp row and a proposed
-- change to a session row land in the same queue, because a reviewer works
-- camp-by-camp ("what changed at Art Factory?") and not table-by-table.
-- target_table says which, target_id says which row (NULL for a new row).
--
-- `proposed` holds ONLY the changed fields, so review reads as a diff.
-- `current_values` is a snapshot of those same fields at extraction time, and
-- it is what makes publishing safe: between extraction and approval somebody
-- may have edited the live row by hand, and we must not clobber that. On apply,
-- if the live row no longer matches the snapshot the proposal is marked
-- 'superseded' instead of being written.

BEGIN;

CREATE TABLE IF NOT EXISTS public.camp_updates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id        uuid NOT NULL REFERENCES public.camps(id)        ON DELETE CASCADE,
  source_id      uuid          REFERENCES public.camp_sources(id) ON DELETE SET NULL,
  target_table   text NOT NULL,
  target_id      uuid,
  change_type    text NOT NULL,
  season_year    smallint,
  proposed       jsonb NOT NULL,
  current_values jsonb,
  confidence     numeric(3,2),
  validation     jsonb,
  status         text NOT NULL DEFAULT 'pending',
  content_hash   text,
  extractor      text,
  extracted_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at    timestamptz,
  reviewed_by    text,
  review_note    text,
  applied_at     timestamptz,

  CONSTRAINT camp_updates_target_check CHECK (target_table IN ('camps','camp_sessions')),
  CONSTRAINT camp_updates_change_check CHECK (change_type  IN ('insert','update','delete')),
  CONSTRAINT camp_updates_status_check CHECK (status IN
    ('pending','needs_review','approved','rejected','applied','superseded')),
  CONSTRAINT camp_updates_confidence_range CHECK
    (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  -- Only an insert may lack a target row.
  CONSTRAINT camp_updates_target_id_required CHECK
    (change_type = 'insert' OR target_id IS NOT NULL),
  -- A delete has nothing to propose; everything else must propose something.
  CONSTRAINT camp_updates_proposed_nonempty CHECK
    (change_type = 'delete' OR proposed <> '{}'::jsonb)
);

COMMENT ON TABLE public.camp_updates IS
  'Staging queue. Nothing here is visible to parents until apply_camp_update() '
  'publishes it. Internal data — RLS on, no policies, service role only.';
COMMENT ON COLUMN public.camp_updates.proposed IS
  'Only the fields that changed, as {column: new_value}. Reviewed as a diff.';
COMMENT ON COLUMN public.camp_updates.current_values IS
  'The same fields as they were at extraction time. Compared against the live row '
  'on apply; a mismatch means a human edited it meanwhile, so we do not clobber.';
COMMENT ON COLUMN public.camp_updates.validation IS
  'Result of the shared rules in src/lib/validation/campData.ts, as '
  '{ok: bool, issues: [{field, rule, severity, message}]}. A failing rule should '
  'set status to needs_review, never silently drop the row.';
COMMENT ON COLUMN public.camp_updates.extractor IS
  'Script name + version that produced this row, so one bad extractor''s output '
  'can be found and rejected in bulk.';
COMMENT ON COLUMN public.camp_updates.status IS
  'pending -> needs_review (validation flagged it) -> approved -> applied. '
  'rejected = a reviewer said no. superseded = the live row moved under us.';

-- Review queue.
CREATE INDEX IF NOT EXISTS idx_camp_updates_queue
  ON public.camp_updates (status, extracted_at);
CREATE INDEX IF NOT EXISTS idx_camp_updates_camp
  ON public.camp_updates (camp_id, status);

-- A nightly crawl that re-finds the same unchanged proposal must not pile up
-- forty identical review items. Scoped to the un-reviewed statuses so the same
-- change CAN be re-proposed after an earlier one was rejected.
-- content_hash NULL never dedupes (NULLs are distinct in a unique index), which
-- is the safe direction: an unhashed proposal is always queued.
CREATE UNIQUE INDEX IF NOT EXISTS camp_updates_pending_dedupe
  ON public.camp_updates (
       target_table,
       coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid),
       content_hash)
  WHERE status IN ('pending','needs_review');

-- RLS on, NO policies: service-role only, same as email_signups. Un-reviewed
-- extracted data must never reach the browser's anon key.
ALTER TABLE public.camp_updates ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Publishing.
--
-- One function so the whole publish is atomic and the apply rules live next to
-- the data rather than in whichever script happens to call it.
--
-- Refuses anything not already 'approved' — validation and review are not this
-- function's job, and it will not promote a row on its own.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_camp_update(update_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  u          public.camp_updates;
  live       jsonb;
  bad        text[];
  assigns    text;
  cols       text;
  vals       text;
  new_id     uuid;
  new_status text;
  src_url    text;
  affected   integer;
  k          text;
BEGIN
  SELECT * INTO u FROM public.camp_updates WHERE id = update_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'apply_camp_update: no camp_updates row %', update_id;
  END IF;

  IF u.status <> 'approved' THEN
    RAISE EXCEPTION 'apply_camp_update: row % has status %, expected approved',
      update_id, u.status;
  END IF;

  -- A new session belongs to the camp the proposal is filed under.
  IF u.change_type = 'insert'
     AND u.target_table = 'camp_sessions'
     AND NOT (u.proposed ? 'camp_id') THEN
    u.proposed := u.proposed || jsonb_build_object('camp_id', u.camp_id);
  END IF;

  -- Never let a proposal rewrite identity/bookkeeping columns, and never let it
  -- name a column that is generated or does not exist (season_year is generated
  -- from start_date and would error).
  IF u.change_type <> 'delete' THEN
    SELECT array_agg(t.key) INTO bad
      FROM jsonb_object_keys(u.proposed) AS t(key)
     WHERE t.key IN ('id','created_at','updated_at')
        OR t.key NOT IN (
             SELECT c.column_name
               FROM information_schema.columns c
              WHERE c.table_schema = 'public'
                AND c.table_name   = u.target_table
                AND c.is_generated = 'NEVER');
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION 'apply_camp_update: row % proposes columns that cannot be written: %',
        update_id, bad;
    END IF;
  END IF;

  -- Conflict detection: has the live row moved since extraction?
  IF u.change_type <> 'insert' AND u.current_values IS NOT NULL THEN
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1', u.target_table)
       INTO live USING u.target_id;

    IF live IS NULL THEN
      UPDATE public.camp_updates
         SET status = 'superseded',
             review_note = concat_ws(' | ', review_note,
               'Target row no longer exists at apply time.')
       WHERE id = update_id;
      RETURN 'superseded';
    END IF;

    FOR k IN SELECT jsonb_object_keys(u.current_values) LOOP
      IF (live -> k) IS DISTINCT FROM (u.current_values -> k) THEN
        UPDATE public.camp_updates
           SET status = 'superseded',
               review_note = concat_ws(' | ', review_note,
                 format('Live %s changed since extraction (was %s, now %s).',
                        k, u.current_values -> k, live -> k))
         WHERE id = update_id;
        RETURN 'superseded';
      END IF;
    END LOOP;
  END IF;

  -- Apply. jsonb_populate_record casts each value to its real column type, so
  -- a date stays a date and a price stays numeric.
  IF u.change_type = 'update' THEN
    SELECT string_agg(format('%1$I = p.%1$I', t.key), ', ')
      INTO assigns FROM jsonb_object_keys(u.proposed) AS t(key);

    EXECUTE format(
      'UPDATE public.%1$I AS tgt SET %2$s, updated_at = now() '
      'FROM jsonb_populate_record(NULL::public.%1$I, $1) AS p WHERE tgt.id = $2',
      u.target_table, assigns)
    USING u.proposed, u.target_id;

    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'apply_camp_update: row % updated % rows, expected 1',
        update_id, affected;
    END IF;

  ELSIF u.change_type = 'insert' THEN
    SELECT string_agg(format('%I', t.key), ', '),
           string_agg(format('p.%I', t.key), ', ')
      INTO cols, vals FROM jsonb_object_keys(u.proposed) AS t(key);

    EXECUTE format(
      'INSERT INTO public.%1$I (%2$s) '
      'SELECT %3$s FROM jsonb_populate_record(NULL::public.%1$I, $1) AS p RETURNING id',
      u.target_table, cols, vals)
    INTO new_id USING u.proposed;

  ELSIF u.change_type = 'delete' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', u.target_table)
    USING u.target_id;

    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'apply_camp_update: row % deleted % rows, expected 1',
        update_id, affected;
    END IF;
  END IF;

  -- Stamp provenance on what we just wrote.
  --
  -- 'auto' vs 'human_checked' follows who approved it: an unattributed approval
  -- (reviewed_by NULL, or the literal 'auto') is machine-published data and is
  -- labelled as such. The label describes the provenance of the data now in the
  -- row, so it is set unconditionally — a camp that confirmed last season's
  -- dates has not confirmed the ones we just extracted.
  new_status := CASE
                  WHEN u.reviewed_by IS NULL OR u.reviewed_by = 'auto' THEN 'auto'
                  ELSE 'human_checked'
                END;

  SELECT url INTO src_url FROM public.camp_sources WHERE id = u.source_id;

  IF u.change_type <> 'delete' THEN
    IF u.target_table = 'camp_sessions' THEN
      UPDATE public.camp_sessions
         SET verification_status = new_status,
             last_verified_at    = now(),
             source_url          = COALESCE(src_url, source_url),
             updated_at          = now()
       WHERE id = COALESCE(u.target_id, new_id);

      -- season_year on camps is a season label, not a trust claim, so a session
      -- publish may move it. camps.verification_status is deliberately NOT
      -- touched here: the camp record itself was not re-checked.
      UPDATE public.camps
         SET season_year = COALESCE(u.season_year, season_year),
             updated_at  = now()
       WHERE id = u.camp_id;

    ELSE
      UPDATE public.camps
         SET verification_status = new_status,
             last_verified_at    = now(),
             source_url          = COALESCE(src_url, source_url),
             season_year         = COALESCE(u.season_year, season_year),
             updated_at          = now()
       WHERE id = u.camp_id;
    END IF;
  END IF;

  UPDATE public.camp_updates
     SET status     = 'applied',
         applied_at = now(),
         target_id  = COALESCE(target_id, new_id)
   WHERE id = update_id;

  RETURN 'applied';
END $fn$;

COMMENT ON FUNCTION public.apply_camp_update(uuid) IS
  'Publishes one approved camp_updates row, atomically. Returns ''applied'' or '
  '''superseded''. Raises if the row is not approved or proposes unwritable columns.';

-- SECURITY DEFINER functions are granted to PUBLIC by default — revoke that
-- before anything else can reach it.
REVOKE ALL ON FUNCTION public.apply_camp_update(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_camp_update(uuid) TO service_role;

COMMIT;
