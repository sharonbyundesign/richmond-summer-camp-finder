-- 001 · Trust and provenance fields on camps AND camp_sessions.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected (a text selection makes the editor run only that part).
-- Wrapped in BEGIN/COMMIT: on any error it rolls back with NO changes.
-- Safe to re-run — every statement is guarded.
--
-- Rollback: 001_camp_trust_fields.down.sql (drops the columns, so the values
-- they hold are lost; see supabase/migrations/README.md).
--
-- WHY BOTH TABLES CARRY TRUST FIELDS:
--   The session is what a parent actually acts on — "can my 7-year-old go the
--   week of July 12, and what does it cost?" Dates, price and ages are columns
--   on camp_sessions, and a camp averages ~4 sessions often extracted from
--   different pages with genuinely different reliability (a published week grid
--   you trust next to a price you inferred). A single camp-level status cannot
--   say "week 1 is confirmed, week 6 is last year's guess", so sessions carry
--   their own provenance and per-field confidence.
--   camps keeps its own set for the camp record itself (name, location,
--   website), and the camp_trust view at the bottom rolls the sessions up so a
--   card badge has one thing to read.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Shared vocabulary for verification state.
--
-- CHECK constraints rather than a Postgres ENUM type: dropping a CHECK is one
-- reversible statement, while DROP TYPE requires every column to go first and
-- adding enum values later is awkward inside a transaction.
--
--   unverified     no extraction has touched this row for season_year
--   auto           extracted and published without human review
--   human_checked  a reviewer approved it
--   camp_confirmed the camp itself confirmed it (email / phone)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verification_rank(status text)
RETURNS smallint
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE status
           WHEN 'unverified'     THEN 0::smallint
           WHEN 'auto'           THEN 1::smallint
           WHEN 'human_checked'  THEN 2::smallint
           WHEN 'camp_confirmed' THEN 3::smallint
         END;
$$;

COMMENT ON FUNCTION public.verification_rank(text) IS
  'Orders verification_status weakest-first so queries and views can take a MIN. '
  'Returns NULL for an unrecognised status rather than guessing.';

-- ---------------------------------------------------------------------------
-- 1) Camp-level provenance (the camp record itself).
-- ---------------------------------------------------------------------------
ALTER TABLE public.camps
  ADD COLUMN IF NOT EXISTS source_url          text,
  ADD COLUMN IF NOT EXISTS season_year         smallint,
  ADD COLUMN IF NOT EXISTS last_verified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified';

COMMENT ON COLUMN public.camps.source_url IS
  'The specific page this camp record was extracted from (e.g. /about, /summer-camp). '
  'NOT a duplicate of website_url, which is the homepage we link parents to.';
COMMENT ON COLUMN public.camps.season_year IS
  'Which summer the data on this camp and its sessions describes. Parents must '
  'never see last year''s dates presented as this year''s.';
COMMENT ON COLUMN public.camps.last_verified_at IS
  'When a human or an extraction last confirmed this camp against its source. '
  'NULL means never — do not render it as "verified just now".';
COMMENT ON COLUMN public.camps.verification_status IS
  'Trust state of the CAMP record (name, location, website). Session dates, '
  'price and ages carry their own status on camp_sessions.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.camps'::regclass
       AND conname  = 'camps_verification_status_check'
  ) THEN
    ALTER TABLE public.camps
      ADD CONSTRAINT camps_verification_status_check
      CHECK (verification_status IN ('unverified','auto','human_checked','camp_confirmed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_camps_verification_status
  ON public.camps (verification_status, season_year);

-- ---------------------------------------------------------------------------
-- 2) Session-level provenance + per-field confidence.
--
-- Three typed confidence columns rather than one jsonb blob: there are exactly
-- three, with no sign of a fourth, and columns are constraint-checkable.
--
-- NULL confidence means "never scored", NOT "zero confidence". The UI has to be
-- able to tell "we have not assessed this" from "we assessed it and it is bad".
-- ---------------------------------------------------------------------------
ALTER TABLE public.camp_sessions
  ADD COLUMN IF NOT EXISTS source_url          text,
  ADD COLUMN IF NOT EXISTS last_verified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS confidence_dates    numeric(3,2),
  ADD COLUMN IF NOT EXISTS confidence_price    numeric(3,2),
  ADD COLUMN IF NOT EXISTS confidence_ages     numeric(3,2);

-- Generated + STORED so it can never drift from start_date, and gives the
-- 2026-vs-2027 split for free. EXTRACT over a `date` column is immutable
-- (it would not be over timestamptz).
ALTER TABLE public.camp_sessions
  ADD COLUMN IF NOT EXISTS season_year smallint
    GENERATED ALWAYS AS (EXTRACT(YEAR FROM start_date)::smallint) STORED;

COMMENT ON COLUMN public.camp_sessions.source_url IS
  'The page this session row was extracted from — often a schedule or rates page, '
  'not the camp homepage. NULL where the origin is unknown (all pre-2027 rows).';
COMMENT ON COLUMN public.camp_sessions.last_verified_at IS
  'When this session''s dates/price/ages were last confirmed against source. '
  'NULL means never.';
COMMENT ON COLUMN public.camp_sessions.verification_status IS
  'Trust state of THIS session''s dates, price and ages. Per-session because one '
  'week can be confirmed while another is still a guess.';
COMMENT ON COLUMN public.camp_sessions.confidence_dates IS
  '0..1 confidence in start_date/end_date. NULL = never scored, not zero.';
COMMENT ON COLUMN public.camp_sessions.confidence_price IS
  '0..1 confidence in price. NULL = never scored, not zero. Note that price IS '
  'NULL ("unknown") and price = 0 ("free") are different claims.';
COMMENT ON COLUMN public.camp_sessions.confidence_ages IS
  '0..1 confidence in min_age/max_age. NULL = never scored, not zero.';
COMMENT ON COLUMN public.camp_sessions.season_year IS
  'Derived from start_date. Generated — never write to it directly.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.camp_sessions'::regclass
       AND conname  = 'camp_sessions_verification_status_check'
  ) THEN
    ALTER TABLE public.camp_sessions
      ADD CONSTRAINT camp_sessions_verification_status_check
      CHECK (verification_status IN ('unverified','auto','human_checked','camp_confirmed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.camp_sessions'::regclass
       AND conname  = 'camp_sessions_confidence_range'
  ) THEN
    ALTER TABLE public.camp_sessions
      ADD CONSTRAINT camp_sessions_confidence_range CHECK (
        (confidence_dates IS NULL OR confidence_dates BETWEEN 0 AND 1) AND
        (confidence_price IS NULL OR confidence_price BETWEEN 0 AND 1) AND
        (confidence_ages  IS NULL OR confidence_ages  BETWEEN 0 AND 1));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_camp_sessions_season_year
  ON public.camp_sessions (season_year);
CREATE INDEX IF NOT EXISTS idx_camp_sessions_verification_status
  ON public.camp_sessions (verification_status, season_year);

-- ---------------------------------------------------------------------------
-- 3) Backfill: everything we have today is 2026 data, unverified for 2027.
--
-- camps.source_url is seeded from website_url as a starting point for the
-- crawler, NOT as a provenance claim — verification_status 'unverified' and a
-- NULL last_verified_at sit right beside it so nothing can read it as one.
--
-- camp_sessions.source_url stays NULL on purpose: these rows were hand-entered
-- from the fill-camp-sessions*.sql batches and the specific page each came from
-- was never recorded. A guess here would be worse than an admission.
--
-- Scoped to season_year IS NULL / status defaults so a re-run cannot reset rows
-- that have since been verified.
-- ---------------------------------------------------------------------------
UPDATE public.camps
   SET season_year         = 2026,
       verification_status = 'unverified',
       source_url          = COALESCE(source_url, website_url)
 WHERE season_year IS NULL;

-- Sessions: the generated season_year already reads 2026 from start_date, so
-- there is nothing to set there. Confidence stays NULL — none of it has been
-- scored, and 0 would claim we assessed it and found it worthless.

-- ---------------------------------------------------------------------------
-- 4) Camp-level rollup, so a card badge has one thing to read.
--
-- Confidence and status are the WORST across the camp's in-season sessions: a
-- badge must not average away the one week whose price is a guess.
--
-- security_invoker makes the view honour the caller's RLS instead of the
-- owner's (Postgres 15+, which is every current Supabase project).
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.camp_trust;
CREATE VIEW public.camp_trust WITH (security_invoker = on) AS
SELECT c.id AS camp_id,
       c.verification_status AS camp_verification_status,
       c.last_verified_at    AS camp_last_verified_at,
       c.season_year,
       c.source_url,
       -- Weakest session status, as text, over sessions in the camp's season.
       (ARRAY['unverified','auto','human_checked','camp_confirmed'])[
         min(public.verification_rank(s.verification_status))
           FILTER (WHERE s.season_year = c.season_year) + 1
       ] AS weakest_session_status,
       min(s.last_verified_at) FILTER (WHERE s.season_year = c.season_year)
         AS oldest_session_verified_at,
       min(s.confidence_dates) FILTER (WHERE s.season_year = c.season_year)
         AS worst_dates_confidence,
       min(s.confidence_price) FILTER (WHERE s.season_year = c.season_year)
         AS worst_price_confidence,
       min(s.confidence_ages)  FILTER (WHERE s.season_year = c.season_year)
         AS worst_ages_confidence,
       count(s.id) FILTER (WHERE s.season_year = c.season_year) AS sessions_in_season,
       count(s.id)                                              AS sessions_total
  FROM public.camps c
  LEFT JOIN public.camp_sessions s ON s.camp_id = c.id
 GROUP BY c.id;

COMMENT ON VIEW public.camp_trust IS
  'Camp-level trust rollup. Session columns are the WORST across the camp''s '
  'in-season sessions — a badge must not average away one untrustworthy price. '
  'sessions_in_season = 0 means we have nothing to show for camps.season_year.';

GRANT SELECT ON public.camp_trust TO anon, authenticated;

COMMIT;
