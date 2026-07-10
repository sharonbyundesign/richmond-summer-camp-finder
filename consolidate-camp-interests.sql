-- Consolidate camp_interests into a clean, fixed set of top-level categories.
--
-- Problem: `camp_interests` had 209 rows with case duplicates (STEM/stem),
-- separator variants (water_sports / water sports), and a granularity explosion
-- (Drones, LEGO, Dolls sitting next to broad categories). This collapses every
-- existing tag into one of 9 canonical categories and repoints all link tables.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected (a text selection makes the editor run only that part).
-- Wrapped in BEGIN/COMMIT: on any error it rolls back with NO changes.
--
-- Uses ordinary helper tables (prefixed _interest_*) rather than TEMP tables,
-- which the Supabase editor drops between statements; they are removed at the end.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Exhaustive map of every existing tag value (lowercased) -> category.
--    Built from all 92 distinct values currently in the table.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public._interest_map;
CREATE TABLE public._interest_map (raw text PRIMARY KEY, category text NOT NULL);
INSERT INTO public._interest_map (raw, category) VALUES
  -- STEM
  ('stem','STEM'), ('science','STEM'), ('technology','STEM'), ('engineering','STEM'),
  ('math','STEM'), ('robotics','STEM'), ('coding','STEM'), ('experiments','STEM'),
  ('exploration','STEM'), ('cybersecurity','STEM'), ('drones','STEM'), ('lego','STEM'),
  ('building','STEM'), ('design','STEM'), ('architecture','STEM'),
  ('video game design','STEM'), ('video production','STEM'),
  ('stop motion animation','STEM'), ('biology','STEM'),
  -- Arts
  ('art','Arts'), ('arts','Arts'), ('arts and crafts','Arts'), ('crafts','Arts'),
  ('painting','Arts'), ('drawing','Arts'), ('sculpture','Arts'), ('creativity','Arts'),
  ('creative','Arts'), ('creative play','Arts'), ('dolls','Arts'),
  -- Performing Arts
  ('performing arts','Performing Arts'), ('performing-arts','Performing Arts'),
  ('theater','Performing Arts'), ('theatre','Performing Arts'), ('drama','Performing Arts'),
  ('dance','Performing Arts'), ('music','Performing Arts'), ('comedy','Performing Arts'),
  ('improv','Performing Arts'), ('performance','Performing Arts'),
  ('music production','Performing Arts'),
  -- Sports
  ('sports','Sports'), ('swim','Sports'), ('swimming','Sports'), ('martial arts','Sports'),
  ('fitness','Sports'), ('gymnastics','Sports'), ('water sports','Sports'),
  ('water_sports','Sports'), ('water activities','Sports'), ('water safety','Sports'),
  ('team building','Sports'), ('team_building','Sports'), ('games','Sports'),
  -- Outdoors & Nature
  ('outdoors','Outdoors & Nature'), ('outdoor','Outdoors & Nature'),
  ('outdoor adventures','Outdoors & Nature'), ('nature','Outdoors & Nature'),
  ('adventure','Outdoors & Nature'), ('fishing','Outdoors & Nature'),
  ('biking','Outdoors & Nature'), ('animals','Outdoors & Nature'),
  ('wildlife','Outdoors & Nature'), ('gardening','Outdoors & Nature'),
  ('farming','Outdoors & Nature'), ('environmental education','Outdoors & Nature'),
  ('field trips','Outdoors & Nature'), ('field-trips','Outdoors & Nature'),
  -- Academics
  ('academic','Academics'), ('academics','Academics'), ('debate','Academics'),
  ('public speaking','Academics'), ('law','Academics'), ('mock trial','Academics'),
  ('leadership','Academics'), ('critical thinking','Academics'), ('enrichment','Academics'),
  ('character development','Academics'), ('executive functioning','Academics'),
  ('brain development','Academics'),
  -- Culinary
  ('cooking','Culinary'), ('culinary arts','Culinary'), ('nutrition','Culinary'),
  ('life skills','Culinary'),
  -- Culture
  ('culture','Culture'), ('cultural','Culture'), ('world cultures','Culture'),
  ('museum','Culture'), ('disney','Culture'),
  -- Faith
  ('faith','Faith'), ('religious','Faith'), ('community','Faith');

-- ---------------------------------------------------------------------------
-- 2) Safety net: fail loudly (and roll back) if any existing interest row has
--    no category mapping, so we never silently orphan a camp's links.
-- ---------------------------------------------------------------------------
DO $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing
  FROM public.camp_interests ci
  WHERE NOT EXISTS (
    SELECT 1 FROM public._interest_map m
    WHERE m.raw = lower(trim(coalesce(NULLIF(ci.tag,''), ci.interest_name)))
  );
  IF missing > 0 THEN
    RAISE EXCEPTION 'Aborting: % camp_interests row(s) had no category mapping', missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Pick ONE canonical row per category (deterministically, the smallest id
--    among that category's rows) and remember old-row -> canonical-row.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public._interest_canon;
CREATE TABLE public._interest_canon AS
SELECT m.category, min(ci.id) AS canon_id
FROM public.camp_interests ci
JOIN public._interest_map m
  ON m.raw = lower(trim(coalesce(NULLIF(ci.tag,''), ci.interest_name)))
GROUP BY m.category;

DROP TABLE IF EXISTS public._interest_remap;
CREATE TABLE public._interest_remap AS
SELECT ci.id AS old_id, cn.canon_id AS new_id
FROM public.camp_interests ci
JOIN public._interest_map m
  ON m.raw = lower(trim(coalesce(NULLIF(ci.tag,''), ci.interest_name)))
JOIN public._interest_canon cn ON cn.category = m.category;

-- ---------------------------------------------------------------------------
-- 4) Relabel the surviving canonical rows to the clean category names.
-- ---------------------------------------------------------------------------
UPDATE public.camp_interests ci
SET tag = cn.category, interest_name = cn.category
FROM public._interest_canon cn
WHERE ci.id = cn.canon_id;

-- ---------------------------------------------------------------------------
-- 5) Repoint every link table onto the canonical rows, de-duplicated.
--    A single camp can link to several old rows that collapse to the SAME
--    category (e.g. drones + lego + coding -> STEM), so we build the deduped
--    target set first, then swap it in wholesale (avoids a transient PK clash).
-- ---------------------------------------------------------------------------
-- camps <-> interests
DROP TABLE IF EXISTS public._new_camp_links;
CREATE TABLE public._new_camp_links AS
SELECT DISTINCT l.camp_id, COALESCE(r.new_id, l.camp_interest_id) AS camp_interest_id
FROM public.camp_interest_links l
LEFT JOIN public._interest_remap r ON r.old_id = l.camp_interest_id;

DELETE FROM public.camp_interest_links;
INSERT INTO public.camp_interest_links (camp_id, camp_interest_id)
SELECT camp_id, camp_interest_id FROM public._new_camp_links;

-- sessions <-> interests (currently empty, handled for safety)
DROP TABLE IF EXISTS public._new_session_links;
CREATE TABLE public._new_session_links AS
SELECT DISTINCT l.camp_session_id, COALESCE(r.new_id, l.camp_interest_id) AS camp_interest_id
FROM public.camp_session_interest_links l
LEFT JOIN public._interest_remap r ON r.old_id = l.camp_interest_id;

DELETE FROM public.camp_session_interest_links;
INSERT INTO public.camp_session_interest_links (camp_session_id, camp_interest_id)
SELECT camp_session_id, camp_interest_id FROM public._new_session_links;

-- children <-> interests (keep earliest created_at when two collapse into one)
DROP TABLE IF EXISTS public._new_child_interests;
CREATE TABLE public._new_child_interests AS
SELECT c.child_profile_id,
       COALESCE(r.new_id, c.camp_interest_id) AS camp_interest_id,
       min(c.created_at) AS created_at
FROM public.child_interests c
LEFT JOIN public._interest_remap r ON r.old_id = c.camp_interest_id
GROUP BY c.child_profile_id, COALESCE(r.new_id, c.camp_interest_id);

DELETE FROM public.child_interests;
INSERT INTO public.child_interests (child_profile_id, camp_interest_id, created_at)
SELECT child_profile_id, camp_interest_id, created_at FROM public._new_child_interests;

-- ---------------------------------------------------------------------------
-- 6) Delete the now-orphaned old interest rows, leaving only the 9 categories.
-- ---------------------------------------------------------------------------
DELETE FROM public.camp_interests
WHERE id NOT IN (SELECT canon_id FROM public._interest_canon);

-- ---------------------------------------------------------------------------
-- 7) Clean up helper tables.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public._new_camp_links;
DROP TABLE IF EXISTS public._new_session_links;
DROP TABLE IF EXISTS public._new_child_interests;
DROP TABLE IF EXISTS public._interest_remap;
DROP TABLE IF EXISTS public._interest_canon;
DROP TABLE IF EXISTS public._interest_map;

-- ---------------------------------------------------------------------------
-- 8) Report the final state (should be exactly the 9 categories).
-- ---------------------------------------------------------------------------
SELECT ci.tag AS category,
       (SELECT count(*) FROM public.camp_interest_links l WHERE l.camp_interest_id = ci.id) AS camps_linked
FROM public.camp_interests ci
ORDER BY ci.tag;

COMMIT;
