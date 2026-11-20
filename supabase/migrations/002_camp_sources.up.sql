-- 002 · camp_sources: the pages we extract from, and what happened last time.
--
-- Requires: 001 (nothing structural, but the two are one feature).
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT; safe to re-run.
-- Rollback: 002_camp_sources.down.sql (drops the table — provenance history
-- is lost, see supabase/migrations/README.md).
--
-- WHY last_outcome EXISTS ALONGSIDE last_status:
--   An HTTP 200 that turns out to be a JavaScript-only registration portal is a
--   FAILURE for us, and that is the majority case here — of the ~72 camps with
--   session gaps, only about 8 publish a schedule a crawler can read. The rest
--   are portal, PDF or franchise-gated. A status code cannot say that;
--   'needs_js' and 'blocked' can, and that is the column that tells you which
--   camps need a phone call instead of another crawl.

BEGIN;

CREATE TABLE IF NOT EXISTS public.camp_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id         uuid NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  url             text NOT NULL,
  url_type        text NOT NULL DEFAULT 'homepage',
  content_hash    text,
  last_fetched_at timestamptz,
  last_status     smallint,
  last_outcome    text,
  last_error      text,
  etag            text,
  last_modified   text,
  fetch_priority  smallint NOT NULL DEFAULT 5,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT camp_sources_url_type_check CHECK (url_type IN
    ('homepage','schedule','pricing','registration','pdf','portal','sitemap','other')),
  CONSTRAINT camp_sources_outcome_check CHECK (last_outcome IS NULL OR last_outcome IN
    ('ok','unchanged','not_found','blocked','needs_js','parse_failed','error')),
  CONSTRAINT camp_sources_priority_check CHECK (fetch_priority BETWEEN 1 AND 9)
);

COMMENT ON TABLE public.camp_sources IS
  'One row per page we extract camp data from. Crawler bookkeeping — not public data.';
COMMENT ON COLUMN public.camp_sources.url_type IS
  'What kind of page this is. Drives which extractor runs and how much to trust it.';
COMMENT ON COLUMN public.camp_sources.content_hash IS
  'Hash of the normalised page body. Unchanged hash => skip the parse.';
COMMENT ON COLUMN public.camp_sources.last_status IS
  'HTTP status of the last fetch. See last_outcome for what it meant for us.';
COMMENT ON COLUMN public.camp_sources.last_outcome IS
  'What the fetch was worth: ok | unchanged | not_found | blocked | needs_js | '
  'parse_failed | error. A 200 that is a JS-only portal is needs_js, not ok.';
COMMENT ON COLUMN public.camp_sources.etag IS
  'For conditional GETs (If-None-Match), so a refetch costs nothing when the page '
  'has not changed. content_hash saves the PARSE; this saves the DOWNLOAD.';
COMMENT ON COLUMN public.camp_sources.last_modified IS
  'Raw Last-Modified header, for If-Modified-Since. Kept as text, not a timestamp: '
  'servers send malformed dates and we want to echo back exactly what we got.';
COMMENT ON COLUMN public.camp_sources.fetch_priority IS
  '1 = highest, 9 = lowest. The handful of camps with a readable schedule should be '
  'polled often; the portal-gated majority should not be hammered.';

-- One row per (camp, url). Re-seeding and re-crawling are both idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS camp_sources_camp_url_key
  ON public.camp_sources (camp_id, url);

-- The crawler's work queue: highest priority first, never-fetched before stale.
CREATE INDEX IF NOT EXISTS idx_camp_sources_queue
  ON public.camp_sources (fetch_priority, last_fetched_at NULLS FIRST);

-- Keeps updated_at honest without every caller having to remember it. The
-- existing tables set updated_at by hand; a crawler table is written too often
-- for that to stay correct.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS camp_sources_touch_updated_at ON public.camp_sources;
CREATE TRIGGER camp_sources_touch_updated_at
  BEFORE UPDATE ON public.camp_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS on, NO policies: service-role only, the same pattern the email_signups
-- table uses. Crawler internals, fetch failures and notes are not public data,
-- and the anon key the browser carries must not read them.
-- ---------------------------------------------------------------------------
ALTER TABLE public.camp_sources ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Seed: every camp's homepage, which is all the provenance we currently have.
-- ---------------------------------------------------------------------------
INSERT INTO public.camp_sources (camp_id, url, url_type, fetch_priority, notes)
SELECT id, btrim(website_url), 'homepage', 5,
       'Seeded from camps.website_url by migration 002.'
  FROM public.camps
 WHERE website_url IS NOT NULL
   AND btrim(website_url) <> ''
ON CONFLICT (camp_id, url) DO NOTHING;

-- Camps with no sessions at all are the ones worth crawling hardest. Derived
-- from live data rather than hardcoding the ids in camp-data-gaps.csv, so this
-- stays correct as gaps get filled.
UPDATE public.camp_sources s
   SET fetch_priority = 1
 WHERE NOT EXISTS (
         SELECT 1 FROM public.camp_sessions ss WHERE ss.camp_id = s.camp_id
       )
   AND s.fetch_priority = 5;

COMMIT;
