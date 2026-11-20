-- Rollback for 005.
--
-- THIS DELETES EVERY SIGNUP. Unlike the other down scripts, what is lost here
-- cannot be reproduced: an address someone typed once is gone for good, and
-- there is no second copy anywhere. Export it first if the list has anything
-- in it:
--
--   SELECT email, source, created_at FROM public.email_signups ORDER BY created_at;
--
-- Dropping the table also drops its unique index and RLS setting.

BEGIN;

DROP TABLE IF EXISTS public.email_signups;

COMMIT;
