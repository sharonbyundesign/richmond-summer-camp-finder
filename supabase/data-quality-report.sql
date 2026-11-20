-- Data-quality report. READ-ONLY — changes nothing, safe to run any time.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and press Run
-- with NOTHING selected.
--
-- Run this BEFORE 004_validation_constraints.up.sql. Every row with
-- severity = 'error' would make that migration's transaction abort; decide what
-- to do about each one first. Rows with severity = 'warning' are review items,
-- not blockers — several of them are correct data about unusual camps.
--
-- Thresholds mirror src/lib/validation/campData.ts, which is canonical. SQL
-- cannot import TypeScript, so a change has to be made in both places.
--
-- As of 2026-11-20 this returns 4 warnings (Jacob's Chance ages) and 3 more
-- (Let's Grow, Henrico! free sessions), and zero errors.

WITH session_checks AS (
  SELECT 'error'   AS severity, 'age_sane'       AS rule, s.id, c.name AS camp,
         format('min_age=%s max_age=%s', s.min_age, s.max_age) AS detail
    FROM public.camp_sessions s JOIN public.camps c ON c.id = s.camp_id
   WHERE (s.min_age IS NOT NULL AND s.min_age NOT BETWEEN 0 AND 99)
      OR (s.max_age IS NOT NULL AND s.max_age NOT BETWEEN 0 AND 99)
      OR (s.min_age IS NOT NULL AND s.max_age IS NOT NULL AND s.min_age > s.max_age)

  UNION ALL
  SELECT 'error', 'price_sane', s.id, c.name, format('price=%s', s.price)
    FROM public.camp_sessions s JOIN public.camps c ON c.id = s.camp_id
   WHERE s.price IS NOT NULL AND s.price NOT BETWEEN 0 AND 5000

  UNION ALL
  SELECT 'error', 'date_order', s.id, c.name,
         format('%s .. %s', s.start_date, s.end_date)
    FROM public.camp_sessions s JOIN public.camps c ON c.id = s.camp_id
   WHERE s.start_date IS NOT NULL AND s.end_date IS NOT NULL AND s.start_date > s.end_date

  UNION ALL
  SELECT 'error', 'duration_sane', s.id, c.name,
         format('%s days', s.end_date - s.start_date)
    FROM public.camp_sessions s JOIN public.camps c ON c.id = s.camp_id
   WHERE s.start_date IS NOT NULL AND s.end_date IS NOT NULL
     AND s.end_date - s.start_date > 120

  -- Warnings below: unusual, possibly correct.
  UNION ALL
  SELECT 'warning', 'age_typical', s.id, c.name,
         format('min_age=%s max_age=%s', s.min_age, s.max_age)
    FROM public.camp_sessions s JOIN public.camps c ON c.id = s.camp_id
   WHERE (s.min_age IS NOT NULL AND s.min_age NOT BETWEEN 3 AND 18)
      OR (s.max_age IS NOT NULL AND s.max_age NOT BETWEEN 3 AND 18)

  UNION ALL
  SELECT 'warning', 'price_free', s.id, c.name, 'price = 0'
    FROM public.camp_sessions s JOIN public.camps c ON c.id = s.camp_id
   WHERE s.price = 0

  UNION ALL
  SELECT 'warning', 'price_typical', s.id, c.name, format('price=%s', s.price)
    FROM public.camp_sessions s JOIN public.camps c ON c.id = s.camp_id
   WHERE s.price IS NOT NULL AND s.price <> 0 AND s.price NOT BETWEEN 25 AND 2500

  UNION ALL
  SELECT 'warning', 'missing_price', s.id, c.name, 'price IS NULL'
    FROM public.camp_sessions s JOIN public.camps c ON c.id = s.camp_id
   WHERE s.price IS NULL

  UNION ALL
  SELECT 'warning', 'missing_ages', s.id, c.name,
         format('min_age=%s max_age=%s', s.min_age, s.max_age)
    FROM public.camp_sessions s JOIN public.camps c ON c.id = s.camp_id
   WHERE s.min_age IS NULL OR s.max_age IS NULL
),
camp_checks AS (
  SELECT 'error' AS severity, 'coords_paired' AS rule, c.id, c.name AS camp,
         format('lat=%s lng=%s', c.latitude, c.longitude) AS detail
    FROM public.camps c
   WHERE (c.latitude IS NULL) <> (c.longitude IS NULL)

  UNION ALL
  -- Bounding box of a 50-mile circle around downtown Richmond.
  SELECT 'error', 'richmond_bbox', c.id, c.name,
         format('lat=%s lng=%s', c.latitude, c.longitude)
    FROM public.camps c
   WHERE c.latitude IS NOT NULL
     AND NOT (c.latitude BETWEEN 36.81 AND 38.27 AND c.longitude BETWEEN -78.35 AND -76.52)

  UNION ALL
  SELECT 'warning', 'missing_coords', c.id, c.name, COALESCE(c.location, '(no location)')
    FROM public.camps c
   WHERE c.latitude IS NULL

  UNION ALL
  SELECT 'warning', 'no_sessions', c.id, c.name, 'camp has zero sessions'
    FROM public.camps c
   WHERE NOT EXISTS (SELECT 1 FROM public.camp_sessions s WHERE s.camp_id = c.id)

  UNION ALL
  -- Hotlinked photos rot silently; next.config.js allows any remote host, so
  -- nothing in the app notices when one 404s.
  SELECT 'warning', 'external_image', c.id, c.name, c.image_url
    FROM public.camps c
   WHERE c.image_url IS NOT NULL
     AND c.image_url NOT LIKE '%supabase.co%'
)
SELECT severity, rule, camp, detail, id
  FROM (SELECT * FROM session_checks UNION ALL SELECT * FROM camp_checks) all_checks
 ORDER BY CASE severity WHEN 'error' THEN 0 ELSE 1 END, rule, camp;
