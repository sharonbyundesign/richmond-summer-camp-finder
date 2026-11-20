-- 005 · Email updates list.
--
-- Requires: nothing. Independent of 001-004.
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT; safe to re-run.
-- Rollback: 005_email_signups.down.sql — which DELETES every address.
--
-- Addresses are personal data, so this table is service-role only: RLS is on
-- with no policies, which closes it to the anon key the browser carries. The
-- /api/signup route writes it with SUPABASE_SERVICE_ROLE_KEY, server-side.

BEGIN;

CREATE TABLE IF NOT EXISTS public.email_signups (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text        NOT NULL,
  source     text,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.email_signups IS
  'Email list for occasional camp updates. No cadence is promised to '
  'subscribers. Personal data: service-role access only.';
COMMENT ON COLUMN public.email_signups.source IS
  'Where the person signed up: the placement id passed by UpdatesSignup '
  '(e.g. ''footer'', ''empty-state''). Null if the caller omitted it.';

-- Case-insensitive uniqueness: one row per address whatever the casing.
-- /api/signup normalizes to lower(trim(email)) before inserting, so this index
-- also backs the 23505 that the route deliberately reports as success.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_signups_email_lower
  ON public.email_signups (lower(email));

ALTER TABLE public.email_signups ENABLE ROW LEVEL SECURITY;

COMMIT;
