-- 004 DOWN · Remove the hard validation constraints.
--
-- Not destructive: drops rules, keeps data. Running this lets impossible ages,
-- negative prices and out-of-region coordinates back in, so only do it to
-- unblock an import you intend to clean up immediately afterwards.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT.

BEGIN;

ALTER TABLE public.camp_sessions
  DROP CONSTRAINT IF EXISTS camp_sessions_age_sane,
  DROP CONSTRAINT IF EXISTS camp_sessions_price_sane,
  DROP CONSTRAINT IF EXISTS camp_sessions_date_order,
  DROP CONSTRAINT IF EXISTS camp_sessions_duration_sane;

ALTER TABLE public.camps
  DROP CONSTRAINT IF EXISTS camps_coords_paired,
  DROP CONSTRAINT IF EXISTS camps_richmond_bbox;

COMMIT;
