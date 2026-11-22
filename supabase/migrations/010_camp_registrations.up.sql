-- 010 · camp_registrations: when each camp's registration opens, per summer.
--
-- Requires: 008 (camp_submissions, which gains registration columns here).
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT; safe to re-run.
-- Rollback: 010_camp_registrations.down.sql.
--
-- Popular Richmond camps fill within hours of opening registration, so the
-- date it opens is what a parent plans around. One row per camp and summer:
-- the day (and, if known, the time) registration opens for everyone, an
-- earlier priority date (members, returning families) if there is one, a
-- free-text note for what doesn't fit a date ("mid to late February"), the
-- registration link, where it stands now, and whether it sold out last year.
--
-- Public like camp_locations: it's on every camp page. Writes are service role
-- only (the review tool and scripts).

BEGIN;

CREATE TABLE IF NOT EXISTS public.camp_registrations (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id             uuid        NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  season_year         smallint    NOT NULL,
  -- When registration opens for everyone. Local Richmond time.
  opens_on            date,
  opens_time          time,
  -- An earlier window for members or returning families, if any.
  priority_opens_on   date,
  priority_opens_time time,
  priority_note       text,
  -- What a date can't say: "mid to late February", "applications open now".
  opens_note          text,
  registration_url    text,
  status              text        NOT NULL DEFAULT 'unknown',
  -- Sold out, or nearly, last summer. Shown as "Fills fast".
  fills_fast          boolean     NOT NULL DEFAULT false,
  source_url          text,
  verification_status text        NOT NULL DEFAULT 'auto',
  last_verified_at    timestamptz,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT camp_registrations_one_per_summer UNIQUE (camp_id, season_year),
  CONSTRAINT camp_registrations_status CHECK (status IN ('unknown','upcoming','open','waitlist','full')),
  CONSTRAINT camp_registrations_verification CHECK
    (verification_status IN ('unverified','auto','human_checked','camp_confirmed')),
  CONSTRAINT camp_registrations_lengths CHECK (
    char_length(coalesce(opens_note, '')) <= 200
    AND char_length(coalesce(priority_note, '')) <= 200
    AND char_length(coalesce(registration_url, '')) <= 500)
);

COMMENT ON TABLE public.camp_registrations IS
  'When each camp''s registration opens, per summer. Public read; service-role writes.';

CREATE INDEX IF NOT EXISTS idx_camp_registrations_season
  ON public.camp_registrations (season_year, opens_on);

ALTER TABLE public.camp_registrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'camp_registrations'
       AND policyname = 'camp_registrations are publicly readable'
  ) THEN
    CREATE POLICY "camp_registrations are publicly readable"
      ON public.camp_registrations FOR SELECT USING (true);
  END IF;
END $$;

-- A camp can tell us its registration date in the same update form it uses
-- for sessions. Stored on the submission; a reviewer publishes it.
ALTER TABLE public.camp_submissions
  ADD COLUMN IF NOT EXISTS registration_opens_on date,
  ADD COLUMN IF NOT EXISTS registration_opens_time time,
  ADD COLUMN IF NOT EXISTS registration_note text,
  ADD COLUMN IF NOT EXISTS registration_url text;

-- A camp may send only its registration date, before its sessions are set.
ALTER TABLE public.camp_submissions DROP CONSTRAINT IF EXISTS camp_submissions_session_count;
ALTER TABLE public.camp_submissions
  ADD CONSTRAINT camp_submissions_session_count CHECK (session_count BETWEEN 0 AND 60);

COMMIT;
