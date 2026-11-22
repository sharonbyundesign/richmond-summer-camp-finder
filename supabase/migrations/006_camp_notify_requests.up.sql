-- 006 · Per-camp "notify me when the new dates are posted" requests.
--
-- Requires: nothing beyond the camps table. Independent of 001-005.
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT; safe to re-run.
-- Rollback: 006_camp_notify_requests.down.sql — which DELETES every request.
--
-- Why not email_signups: that table holds one row per address (its unique
-- index is on lower(email)), so a parent already on the updates list who then
-- asks to hear about one particular camp would collide and the camp would be
-- silently lost. A notify request is a different promise — "tell me when THIS
-- camp's dates are up" — and it needs the camp on the row.
--
-- It is also a prioritisation signal: the camps with the most parents waiting
-- are the ones to verify first.
--
-- Personal data, so service-role only: RLS on, no policies. /api/notify writes
-- it server-side with SUPABASE_SERVICE_ROLE_KEY.

BEGIN;

CREATE TABLE IF NOT EXISTS public.camp_notify_requests (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id      uuid        NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  email        text        NOT NULL,
  -- The season they are waiting on. A request for 2027 is answered by 2027
  -- dates, and must not be "satisfied" by a re-check of last year's.
  season_year  smallint    NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  -- Set when the notification goes out, so nobody is emailed twice and the
  -- waiting count drops as camps are verified.
  notified_at  timestamptz
);

COMMENT ON TABLE public.camp_notify_requests IS
  'Parents waiting for a camp''s dates for a given season. Personal data: '
  'service-role access only.';

-- One request per person per camp per season, whatever the casing.
-- /api/notify normalises to lower(trim(email)) and treats 23505 as success.
CREATE UNIQUE INDEX IF NOT EXISTS idx_camp_notify_unique
  ON public.camp_notify_requests (camp_id, lower(email), season_year);

-- "Who is still waiting on this camp?" — the query the review tool will run.
CREATE INDEX IF NOT EXISTS idx_camp_notify_waiting
  ON public.camp_notify_requests (camp_id, season_year)
  WHERE notified_at IS NULL;

ALTER TABLE public.camp_notify_requests ENABLE ROW LEVEL SECURITY;

COMMIT;
