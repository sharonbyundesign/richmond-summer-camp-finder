-- 001 DOWN · Remove the trust/provenance fields.
--
-- DESTRUCTIVE: dropping a column discards its data. Running this throws away
-- every verification_status, last_verified_at, source_url and confidence score
-- recorded since 001 ran. The 2026 backfill is reproducible (001 up redoes it);
-- human review decisions are NOT.
--
-- Run 004 down first if the validation constraints are in place — they reference
-- no columns from this migration, so order is not strictly required, but keeping
-- teardown in reverse order keeps the state predictable.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT.

BEGIN;

DROP VIEW IF EXISTS public.camp_trust;

ALTER TABLE public.camp_sessions
  DROP CONSTRAINT IF EXISTS camp_sessions_verification_status_check,
  DROP CONSTRAINT IF EXISTS camp_sessions_confidence_range;

DROP INDEX IF EXISTS public.idx_camp_sessions_season_year;
DROP INDEX IF EXISTS public.idx_camp_sessions_verification_status;

ALTER TABLE public.camp_sessions
  DROP COLUMN IF EXISTS source_url,
  DROP COLUMN IF EXISTS last_verified_at,
  DROP COLUMN IF EXISTS verification_status,
  DROP COLUMN IF EXISTS confidence_dates,
  DROP COLUMN IF EXISTS confidence_price,
  DROP COLUMN IF EXISTS confidence_ages,
  DROP COLUMN IF EXISTS season_year;

ALTER TABLE public.camps
  DROP CONSTRAINT IF EXISTS camps_verification_status_check;

DROP INDEX IF EXISTS public.idx_camps_verification_status;

ALTER TABLE public.camps
  DROP COLUMN IF EXISTS source_url,
  DROP COLUMN IF EXISTS season_year,
  DROP COLUMN IF EXISTS last_verified_at,
  DROP COLUMN IF EXISTS verification_status;

-- Dropped last: the view above depends on it.
DROP FUNCTION IF EXISTS public.verification_rank(text);

COMMIT;
