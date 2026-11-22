-- 009 · camp_checkins: parents say how a camp went.
--
-- Requires: nothing beyond the camps table. Independent of 001-008.
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT; safe to re-run.
-- Rollback: 009_camp_checkins.down.sql — which DELETES every check-in.
--
-- A check-in is one parent's answer for one camp and one summer: would they
-- send their child again, a few set tags, and an optional short comment.
--
-- Two gates, for two different risks:
--   1. The parent confirms by clicking a link sent to their email. Until then
--      the check-in counts for nothing. This is what keeps one person from
--      inventing twenty parents.
--   2. A comment is shown only after a reviewer approves it. The answer and
--      tags count once confirmed; a comment is free text, so it waits.
-- Moderation follows published rules (see /terms): a comment that follows them
-- is approved whether it is positive or negative. Camps can flag, not remove.
--
-- Personal data (emails): RLS on, no policies, service role only. Pages read
-- the public summary through the API, which never returns an email.

BEGIN;

CREATE TABLE IF NOT EXISTS public.camp_checkins (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id            uuid        NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  email              text        NOT NULL,
  attended_year      smallint    NOT NULL,
  would_return       boolean     NOT NULL,
  tags               text[]      NOT NULL DEFAULT '{}',
  comment            text,
  -- unconfirmed -> confirmed (email clicked). A comment additionally moves
  -- through comment_status; the answer and tags need only confirmation.
  confirmed_at       timestamptz,
  confirm_token_hash text,
  comment_status     text        NOT NULL DEFAULT 'none',
  reviewed_by        text,
  reviewed_at        timestamptz,
  review_note        text,
  -- sha256 of the sender's IP, only to rate-limit the form. Never the IP.
  ip_hash            text,
  created_at         timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT camp_checkins_comment_status CHECK (comment_status IN ('none','pending','approved','rejected')),
  CONSTRAINT camp_checkins_comment_length CHECK (comment IS NULL OR char_length(comment) <= 280),
  CONSTRAINT camp_checkins_year CHECK (attended_year BETWEEN 2015 AND 2100),
  CONSTRAINT camp_checkins_tags CHECK (cardinality(tags) <= 6)
);

COMMENT ON TABLE public.camp_checkins IS
  'Parent check-ins: would they send their child again, set tags, optional comment. '
  'Counts only once confirmed by email; comments show only once approved. '
  'Personal data: service-role access only.';

-- One check-in per parent per camp per summer, whatever the casing. A second
-- submission for the same summer replaces the first (the API upserts).
CREATE UNIQUE INDEX IF NOT EXISTS idx_camp_checkins_one_per_summer
  ON public.camp_checkins (camp_id, lower(email), attended_year);

-- The public summary reads confirmed check-ins per camp.
CREATE INDEX IF NOT EXISTS idx_camp_checkins_confirmed
  ON public.camp_checkins (camp_id) WHERE confirmed_at IS NOT NULL;

-- The review queue reads confirmed comments waiting on a ruling.
CREATE INDEX IF NOT EXISTS idx_camp_checkins_comment_queue
  ON public.camp_checkins (comment_status, created_at) WHERE comment_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_camp_checkins_token
  ON public.camp_checkins (confirm_token_hash) WHERE confirm_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_camp_checkins_rate
  ON public.camp_checkins (ip_hash, created_at);

ALTER TABLE public.camp_checkins ENABLE ROW LEVEL SECURITY;

COMMIT;
