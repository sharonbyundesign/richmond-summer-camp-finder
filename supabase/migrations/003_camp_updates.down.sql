-- 003 DOWN · Remove the staging queue.
--
-- DESTRUCTIVE: drops every pending, approved and rejected proposal along with
-- the review decisions attached to them. Rows already applied live in camps /
-- camp_sessions and are unaffected.
--
-- Run this BEFORE 002 down (camp_updates.source_id references camp_sources).
--
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT.

BEGIN;

DROP FUNCTION IF EXISTS public.apply_camp_update(uuid);
DROP TABLE IF EXISTS public.camp_updates;

COMMIT;
