-- Counts per rule from data-quality-report.sql, for a quick pass/fail glance.
-- READ-ONLY. Paste into the Supabase SQL Editor and Run with nothing selected.
-- Run the full report for the offending rows.

SELECT 'error'   AS severity, 'age_sane' AS rule, count(*) AS n FROM public.camp_sessions
 WHERE (min_age IS NOT NULL AND min_age NOT BETWEEN 0 AND 99)
    OR (max_age IS NOT NULL AND max_age NOT BETWEEN 0 AND 99)
    OR (min_age IS NOT NULL AND max_age IS NOT NULL AND min_age > max_age)
UNION ALL SELECT 'error','price_sane', count(*) FROM public.camp_sessions
 WHERE price IS NOT NULL AND price NOT BETWEEN 0 AND 5000
UNION ALL SELECT 'error','date_order', count(*) FROM public.camp_sessions
 WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND start_date > end_date
UNION ALL SELECT 'error','duration_sane', count(*) FROM public.camp_sessions
 WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND end_date - start_date > 120
UNION ALL SELECT 'error','coords_paired', count(*) FROM public.camps
 WHERE (latitude IS NULL) <> (longitude IS NULL)
UNION ALL SELECT 'error','richmond_bbox', count(*) FROM public.camps
 WHERE latitude IS NOT NULL
   AND NOT (latitude BETWEEN 36.81 AND 38.27 AND longitude BETWEEN -78.35 AND -76.52)
UNION ALL SELECT 'warning','age_typical', count(*) FROM public.camp_sessions
 WHERE (min_age IS NOT NULL AND min_age NOT BETWEEN 3 AND 18)
    OR (max_age IS NOT NULL AND max_age NOT BETWEEN 3 AND 18)
UNION ALL SELECT 'warning','price_free', count(*) FROM public.camp_sessions WHERE price = 0
UNION ALL SELECT 'warning','missing_price', count(*) FROM public.camp_sessions WHERE price IS NULL
UNION ALL SELECT 'warning','missing_ages', count(*) FROM public.camp_sessions
 WHERE min_age IS NULL OR max_age IS NULL
UNION ALL SELECT 'warning','missing_coords', count(*) FROM public.camps WHERE latitude IS NULL
UNION ALL SELECT 'warning','no_sessions', count(*) FROM public.camps c
 WHERE NOT EXISTS (SELECT 1 FROM public.camp_sessions s WHERE s.camp_id = c.id)
UNION ALL SELECT 'warning','external_image', count(*) FROM public.camps
 WHERE image_url IS NOT NULL AND image_url NOT LIKE '%supabase.co%'
ORDER BY 1, 2;
