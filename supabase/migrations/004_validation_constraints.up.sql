-- 004 · Hard validation constraints.
--
-- Requires: 001 (season_year on camp_sessions is referenced by nothing here,
-- but the two migrations are one feature). Run after 001.
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT; safe to re-run.
-- Rollback: 004_validation_constraints.down.sql.
--
-- BEFORE RUNNING: paste supabase/data-quality-report.sql and check it comes
-- back empty for the "hard" rules. As of 2026-11-20 it does — all 108 camps and
-- 416 sessions pass, so these constraints go in fully validated rather than as
-- NOT VALID. If a later import broke something the transaction aborts and
-- nothing changes, which is the behaviour we want.
--
-- WHAT IS *NOT* HERE, AND WHY
--
-- 1) "Dates within summer 2027" is NOT a table constraint. All 416 existing
--    sessions are 2026, so a hard 2027 window would reject the entire current
--    dataset. The season window is checked by the extractor against the target
--    season_year — see src/lib/validation/campData.ts — and a session outside
--    it becomes a review item, not a silent drop. A camp that genuinely runs a
--    late-September week must be reviewable, not invisible.
--
-- 2) "Ages 3 to 18" is NOT a hard constraint either, and this one matters.
--    Jacob's Chance Summer Camps serves people with disabilities and publishes
--    sessions for ages 8-40 and 10-40. That is correct data about a real camp.
--    A hard 3..18 check would either reject it or force us to misstate who the
--    camp serves. So the DB rejects only impossible ages, and 3..18 is a
--    WARNING in the validator that routes the row to review.
--
-- 3) Price 0 is allowed. Let's Grow, Henrico! is a genuinely free county
--    program. `price IS NULL` ("we do not know") and `price = 0` ("it is free")
--    are different claims and the schema keeps them different.

BEGIN;

-- ---------------------------------------------------------------------------
-- Sessions: only what is impossible or certainly broken.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.camp_sessions'::regclass
                    AND conname  = 'camp_sessions_age_sane') THEN
    ALTER TABLE public.camp_sessions
      ADD CONSTRAINT camp_sessions_age_sane CHECK (
        (min_age IS NULL OR min_age BETWEEN 0 AND 99) AND
        (max_age IS NULL OR max_age BETWEEN 0 AND 99) AND
        (min_age IS NULL OR max_age IS NULL OR min_age <= max_age));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.camp_sessions'::regclass
                    AND conname  = 'camp_sessions_price_sane') THEN
    ALTER TABLE public.camp_sessions
      ADD CONSTRAINT camp_sessions_price_sane CHECK (
        price IS NULL OR price BETWEEN 0 AND 5000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.camp_sessions'::regclass
                    AND conname  = 'camp_sessions_date_order') THEN
    ALTER TABLE public.camp_sessions
      ADD CONSTRAINT camp_sessions_date_order CHECK (
        start_date IS NULL OR end_date IS NULL OR start_date <= end_date);
  END IF;

  -- A session spanning more than a month is not a week of camp; it is almost
  -- always an end_date typo (2027 in place of 2026, or a day-month swap).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.camp_sessions'::regclass
                    AND conname  = 'camp_sessions_duration_sane') THEN
    ALTER TABLE public.camp_sessions
      ADD CONSTRAINT camp_sessions_duration_sane CHECK (
        start_date IS NULL OR end_date IS NULL OR end_date - start_date <= 120);
  END IF;
END $$;

COMMENT ON CONSTRAINT camp_sessions_age_sane ON public.camp_sessions IS
  'Impossible ages only. The 3..18 expectation is a review warning, not an '
  'invariant — Jacob''s Chance genuinely runs sessions for ages up to 40.';
COMMENT ON CONSTRAINT camp_sessions_price_sane ON public.camp_sessions IS
  'price = 0 is allowed and means free. NULL means unknown. Different claims.';

-- ---------------------------------------------------------------------------
-- Camps: coordinates must be in the Richmond service area, or absent.
--
-- The box is the bounding box of a 50-mile circle around downtown Richmond
-- (37.5407, -77.4360). 50 is not arbitrary: it is the widest radius the search
-- pill offers (RADIUS_OPTIONS in src/lib/v2/usePillState.ts), so a parent can
-- ask for camps 50 miles out and anything we store must be able to answer.
-- That reaches Ashland (~16 mi), Petersburg and Pamplin Historical Park
-- (~25 mi) with room to spare.
--
-- The circle itself is checked in the validator; the box is the cheap backstop
-- that stops a decimal-point error from landing a camp in another state.
--
-- Both-or-neither: half a coordinate places a pin in the Atlantic.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.camps'::regclass
                    AND conname  = 'camps_coords_paired') THEN
    ALTER TABLE public.camps
      ADD CONSTRAINT camps_coords_paired CHECK (
        (latitude IS NULL) = (longitude IS NULL));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.camps'::regclass
                    AND conname  = 'camps_richmond_bbox') THEN
    ALTER TABLE public.camps
      ADD CONSTRAINT camps_richmond_bbox CHECK (
        latitude IS NULL OR (
          latitude  BETWEEN  36.81 AND  38.27 AND
          longitude BETWEEN -78.35 AND -76.52));
  END IF;
END $$;

COMMENT ON CONSTRAINT camps_richmond_bbox ON public.camps IS
  'Bounding box of a 50-mile circle around downtown Richmond — the widest radius '
  'the search pill offers. The exact circle is checked in the validator.';

COMMIT;
