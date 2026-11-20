-- 002 DOWN · Remove camp_sources.
--
-- DESTRUCTIVE: drops the table, so every recorded fetch outcome, content hash
-- and crawl note goes with it. Re-running 002 up re-seeds homepages only.
--
-- Run 003 down FIRST: camp_updates.source_id references this table.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT.

BEGIN;

DROP TRIGGER IF EXISTS camp_sources_touch_updated_at ON public.camp_sources;
DROP TABLE IF EXISTS public.camp_sources;

-- Only drop the shared helper if nothing else is still using it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE p.proname = 'touch_updated_at'
       AND NOT t.tgisinternal
  ) THEN
    DROP FUNCTION IF EXISTS public.touch_updated_at();
  END IF;
END $$;

COMMIT;
