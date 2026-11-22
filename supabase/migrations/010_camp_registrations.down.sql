-- 010 rollback · removes camp_registrations and the registration columns on
-- camp_submissions. DELETES every registration date entered. Export first.
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor, nothing selected.

BEGIN;

-- Back to 008's rule (at least one session). NOT VALID leaves any
-- registration-only submissions already stored in place.
ALTER TABLE public.camp_submissions DROP CONSTRAINT IF EXISTS camp_submissions_session_count;
ALTER TABLE public.camp_submissions
  ADD CONSTRAINT camp_submissions_session_count CHECK (session_count BETWEEN 1 AND 60) NOT VALID;

ALTER TABLE public.camp_submissions
  DROP COLUMN IF EXISTS registration_opens_on,
  DROP COLUMN IF EXISTS registration_opens_time,
  DROP COLUMN IF EXISTS registration_note,
  DROP COLUMN IF EXISTS registration_url;

DROP TABLE IF EXISTS public.camp_registrations;

COMMIT;
