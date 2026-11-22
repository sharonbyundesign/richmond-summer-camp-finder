-- 008 · camp_submissions: camps send their own dates through /camps/[id]/update.
--
-- Requires: 003 (camp_updates, apply_camp_update) and 007 (location_id, which a
-- submitted session may carry). Independent of 005 and 006.
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT; safe to re-run.
-- Rollback: 008_camp_submissions.down.sql — which DELETES every submission's
-- contact details (the sessions they proposed stay in camp_updates).
--
-- One submission = one person sending one camp's sessions. Each session lands
-- in camp_updates as its own 'insert' proposal, exactly like the extractor's,
-- so the review tool rules on them the same way; submission_id says who sent
-- it. Nothing reaches parents until a reviewer approves it.
--
-- Contact details are personal data: RLS on, no policies, service role only.
-- /api/camps/[id]/updates writes them server-side.

BEGIN;

CREATE TABLE IF NOT EXISTS public.camp_submissions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id       uuid        NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  contact_name  text        NOT NULL,
  contact_email text        NOT NULL,
  contact_role  text,
  message       text,
  season_year   smallint    NOT NULL,
  session_count smallint    NOT NULL,
  -- sha256 of the sender's IP, only to rate-limit the public form. Never the IP.
  ip_hash       text,
  created_at    timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT camp_submissions_session_count CHECK (session_count BETWEEN 1 AND 60),
  CONSTRAINT camp_submissions_lengths CHECK (
    char_length(contact_name) <= 120 AND char_length(contact_email) <= 254
    AND char_length(coalesce(contact_role, '')) <= 60
    AND char_length(coalesce(message, '')) <= 2000)
);

COMMENT ON TABLE public.camp_submissions IS
  'Sessions a camp sent through its update form, and who sent them. Personal '
  'data: service-role access only.';

CREATE INDEX IF NOT EXISTS idx_camp_submissions_camp
  ON public.camp_submissions (camp_id, created_at);
CREATE INDEX IF NOT EXISTS idx_camp_submissions_rate
  ON public.camp_submissions (ip_hash, created_at);

ALTER TABLE public.camp_submissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.camp_updates
  ADD COLUMN IF NOT EXISTS submission_id uuid
    REFERENCES public.camp_submissions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.camp_updates.submission_id IS
  'Set when the camp itself proposed this through its update form. An approved '
  'proposal with a submission publishes as camp_confirmed.';

CREATE INDEX IF NOT EXISTS idx_camp_updates_submission
  ON public.camp_updates (submission_id) WHERE submission_id IS NOT NULL;

-- apply_camp_update, as in 003, with one change: camp_confirmed for submissions.
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
  --
  -- 008: a proposal that came from the camp's own update form, approved by a
  -- named reviewer, is the camp's word: 'camp_confirmed'. The reviewer's
  -- approval is what vouches that the sender is the camp.
  new_status := CASE
                  WHEN u.reviewed_by IS NULL OR u.reviewed_by = 'auto' THEN 'auto'
                  WHEN u.submission_id IS NOT NULL THEN 'camp_confirmed'
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

REVOKE ALL ON FUNCTION public.apply_camp_update(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_camp_update(uuid) TO service_role;

COMMIT;
