-- Rollback for 006.
--
-- THIS DELETES EVERY NOTIFY REQUEST. Like 005, what is lost cannot be
-- reproduced: each row is a parent who asked to be told about a camp, and
-- there is no other copy. Export first if the table has anything in it:
--
--   SELECT c.name, r.email, r.season_year, r.created_at, r.notified_at
--     FROM public.camp_notify_requests r
--     JOIN public.camps c ON c.id = r.camp_id
--    ORDER BY c.name, r.created_at;

BEGIN;

DROP TABLE IF EXISTS public.camp_notify_requests;

COMMIT;
