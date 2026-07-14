-- Fix: interest filter returns nothing in production.
--
-- The camps<->interests relationship is a many-to-many resolved through the
-- junction table `camp_interest_links`. The original supabase-migration.sql
-- granted public (anon) read access to camps, camp_sessions, and camp_interests
-- but NOT to this junction table, which was added later. RLS is enabled on it
-- with no permissive SELECT policy, so the anon key reads 0 rows.
--
-- Locally the app works only because .env.local carries SUPABASE_SERVICE_ROLE_KEY
-- (which bypasses RLS). Production runs on the anon key, so the embedded
-- `camp_interests(...)` select in /api/camps comes back empty for every camp and
-- the interest filter matches nothing (interest=Sports -> 0 results).
--
-- The interest links are non-sensitive public data, exactly like the tables that
-- already allow public read. This adds the missing policy, plus the matching
-- session-level link table for consistency.

ALTER TABLE public.camp_interest_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_session_interest_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to camp_interest_links"
  ON public.camp_interest_links
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to camp_session_interest_links"
  ON public.camp_session_interest_links
  FOR SELECT USING (true);
