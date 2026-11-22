-- 007 · Camp locations: where each session actually runs.
--
-- Requires: 001 (camp_sessions as it stands after the trust fields). Run after
-- 001-006.
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected. Wrapped in BEGIN/COMMIT; safe to re-run.
-- Rollback: 007_camp_locations.down.sql.
--
-- WHY
--
-- A camp had one address, which three kinds of camp cannot honestly fit:
--   - one program at several sites (YMCA branches, ACAC clubs, Bricks 4 Kidz
--     at different schools);
--   - one organisation running different programs in different places (James
--     River Association: Explorers in Lynchburg, Rainbow in Richmond, an
--     expedition on a river route);
--   - sessions outside the Richmond area altogether (Lynchburg).
-- Sites are stored once, and each session points at the one it runs at.
--
-- WHAT IT DOES TO EXISTING DATA
--
-- Every camp that already has coordinates gets one location row built from
-- its current address, and all its sessions point at it. Nothing a parent
-- sees changes until a camp is given a second site.
--
-- The 11 camps whose "address" is placeholder text ("Multiple Richmond
-- locations", "11 U.S. locations") get NO location row. Turning that text into
-- a site would invent a place that does not exist. Their sessions are left
-- without a location until someone enters the real ones.

BEGIN;

CREATE TABLE IF NOT EXISTS public.camp_locations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id     uuid        NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  -- What a parent would call it: "Glen Allen YMCA", "Lynchburg", "Upper James
  -- Route". Null for backfilled rows — the UI falls back to the city in the
  -- address, which is what the card showed before.
  name        text,
  -- Null for places that are not a building, like a river route. Such a
  -- location still names where a session runs; it just gets no map pin.
  address     text,
  latitude    double precision,
  longitude   double precision,
  -- True data, but not useful to a Richmond family: stored, never shown in
  -- results. Set by whoever enters the site.
  outside_service_area boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.camp_locations IS
  'Where a camp''s sessions run. A camp may have several; each session points '
  'at one via camp_sessions.location_id.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'camp_locations_coords_paired') THEN
    ALTER TABLE public.camp_locations
      ADD CONSTRAINT camp_locations_coords_paired
      CHECK ((latitude IS NULL) = (longitude IS NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_camp_locations_camp ON public.camp_locations (camp_id);

ALTER TABLE public.camp_sessions
  ADD COLUMN IF NOT EXISTS location_id uuid
    REFERENCES public.camp_locations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.camp_sessions.location_id IS
  'The site this session runs at. Null when unknown; the camp''s own address '
  'is used in that case, as before.';

CREATE INDEX IF NOT EXISTS idx_camp_sessions_location ON public.camp_sessions (location_id);

-- Backfill: one location per camp that has a real, geocoded address, scoped so
-- a re-run never duplicates rows or re-points a session someone has moved.
INSERT INTO public.camp_locations (camp_id, address, latitude, longitude)
SELECT c.id, c.location, c.latitude, c.longitude
  FROM public.camps c
 WHERE c.latitude IS NOT NULL
   AND c.longitude IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.camp_locations l WHERE l.camp_id = c.id);

UPDATE public.camp_sessions s
   SET location_id = l.id
  FROM public.camp_locations l
 WHERE l.camp_id = s.camp_id
   AND s.location_id IS NULL
   -- Only where the camp has exactly one site, so the answer is unambiguous.
   AND (SELECT count(*) FROM public.camp_locations l2 WHERE l2.camp_id = s.camp_id) = 1;

-- Addresses are public — they are on every camp page — so this is readable the
-- way camps is. Writes stay service-role only: there is no write policy.
ALTER TABLE public.camp_locations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'camp_locations'
       AND policyname = 'camp_locations are publicly readable'
  ) THEN
    CREATE POLICY "camp_locations are publicly readable"
      ON public.camp_locations FOR SELECT USING (true);
  END IF;
END $$;

COMMIT;
