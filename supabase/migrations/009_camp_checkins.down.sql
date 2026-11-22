-- 009 rollback · removes camp_checkins.
--
-- DELETES every parent check-in, confirmed or not. Unreproducible — export the
-- table first if any were collected.
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor, nothing selected.

BEGIN;

DROP TABLE IF EXISTS public.camp_checkins;

COMMIT;
