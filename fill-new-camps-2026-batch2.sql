-- Add 15 new Richmond-area camps scraped from official sources (July 2026).
-- Sources: each camp's public website / registration portal. Coordinates geocoded
-- offline with the US Census geocoder (same pipeline as fill-camp-data.sql).
-- Camps already in the directory were skipped as duplicates: ClubSciKidz,
-- Riverside Outfitters, SPARC, Young Chefs Academy, James River Association,
-- Weinstein JCC, YMCA.
--
-- Sessions are only inserted where an official 2026 schedule was published. Camps
-- whose sessions live behind registration portals / were only listed for a prior
-- year are added WITHOUT fabricated sessions (name/location/ages only).
--
-- Idempotent: deletes these 15 camps (cascade removes their sessions + interest
-- links) then re-inserts. Safe to re-run. Run once in the Supabase SQL Editor.

BEGIN;

-- Clean slate for just these 15 camps (id list == the ones inserted below).
DELETE FROM public.camp_sessions WHERE camp_id IN (
  'd175543b-2064-49ef-b12c-885a046f98a5','400850a3-544b-4ca3-ad74-1bafab2dd0d7',
  '2f41f59b-7653-42bc-8a26-2e76401ee451','cdd5ff9d-6630-4f55-b554-b7a525ecde34',
  '5725c5ec-9f3f-4d3e-b8ee-4fa9510953de','18722a46-7989-49c0-a478-a0e159091006',
  '69d3a631-3b80-448b-901e-aa0780145783','83a5c64c-8c71-4a42-874b-b5cba5a607e3',
  '5069e503-1ff4-41a8-8297-62ae98294e41','aa28de69-e922-4807-9548-76aa1870c058',
  'a88277ac-3f06-47b9-b47f-7436f6eb6781','ee817d98-de2b-421d-9a45-d4f84d83867a',
  '21d62463-49a2-4d18-9eba-01ed69add4da','cca0cb10-bf28-4cc0-8377-0f14d92b7f5e',
  '7b101c72-e695-47fe-8932-98070d75e9d5'
);
DELETE FROM public.camp_interest_links WHERE camp_id IN (
  'd175543b-2064-49ef-b12c-885a046f98a5','400850a3-544b-4ca3-ad74-1bafab2dd0d7',
  '2f41f59b-7653-42bc-8a26-2e76401ee451','cdd5ff9d-6630-4f55-b554-b7a525ecde34',
  '5725c5ec-9f3f-4d3e-b8ee-4fa9510953de','18722a46-7989-49c0-a478-a0e159091006',
  '69d3a631-3b80-448b-901e-aa0780145783','83a5c64c-8c71-4a42-874b-b5cba5a607e3',
  '5069e503-1ff4-41a8-8297-62ae98294e41','aa28de69-e922-4807-9548-76aa1870c058',
  'a88277ac-3f06-47b9-b47f-7436f6eb6781','ee817d98-de2b-421d-9a45-d4f84d83867a',
  '21d62463-49a2-4d18-9eba-01ed69add4da','cca0cb10-bf28-4cc0-8377-0f14d92b7f5e',
  '7b101c72-e695-47fe-8932-98070d75e9d5'
);
DELETE FROM public.camps WHERE id IN (
  'd175543b-2064-49ef-b12c-885a046f98a5','400850a3-544b-4ca3-ad74-1bafab2dd0d7',
  '2f41f59b-7653-42bc-8a26-2e76401ee451','cdd5ff9d-6630-4f55-b554-b7a525ecde34',
  '5725c5ec-9f3f-4d3e-b8ee-4fa9510953de','18722a46-7989-49c0-a478-a0e159091006',
  '69d3a631-3b80-448b-901e-aa0780145783','83a5c64c-8c71-4a42-874b-b5cba5a607e3',
  '5069e503-1ff4-41a8-8297-62ae98294e41','aa28de69-e922-4807-9548-76aa1870c058',
  'a88277ac-3f06-47b9-b47f-7436f6eb6781','ee817d98-de2b-421d-9a45-d4f84d83867a',
  '21d62463-49a2-4d18-9eba-01ed69add4da','cca0cb10-bf28-4cc0-8377-0f14d92b7f5e',
  '7b101c72-e695-47fe-8932-98070d75e9d5'
);

-- =========================== CAMPS ===========================
INSERT INTO public.camps (id, name, description, location, website_url, latitude, longitude) VALUES

('d175543b-2064-49ef-b12c-885a046f98a5',
 'Cub Scout Day Camp at Deep Run Park',
 'A weeklong outdoor day camp run by the Heart of Virginia Council (Scouting America) for rising kindergartners through rising 4th graders — Scouts and non-Scouts alike. Days are filled with archery, BBs, sports, nature/STEM, crafts, and fishing on a different theme each year.',
 'Deep Run Park, 9900 Ridgefield Parkway, Richmond, VA 23233',
 'https://hovc.org/cub-scout-day-camp/', 37.624380467872, -77.593277569893),

('400850a3-544b-4ca3-ad74-1bafab2dd0d7',
 'Henrico Education Foundation Summer Camps',
 'Learning & Discovery day-camp programs from the Henrico Education Foundation. Each day is a new hands-on adventure with daily field trips to innovation labs, art galleries, nature centers, farms, climbing gyms, and sports clinics. Multi-week sessions at several Henrico elementary schools.',
 '8401 Patterson Avenue, Suite 203, Henrico, VA 23229',
 'https://henricogives.reg.eleyo.com/', 37.594268676892, -77.561181843886),

('2f41f59b-7653-42bc-8a26-2e76401ee451',
 'Passion Academy Summer Camps',
 'Performing-arts camps in Glen Allen where young dancers and actors build a full production over a week — ballet and musical-theatre intensives covering technique, choreography, costume and prop design, culminating in a final performance for family and friends.',
 '3921 Deep Rock Road, Richmond, VA 23233',
 'https://passionacademy.net/events-and-summer-camps/', 37.643172549652, -77.573557580125),

('cdd5ff9d-6630-4f55-b554-b7a525ecde34',
 'Tall Cedars Farm Equestrian Day Camp',
 'A hands-on horsemanship day camp in Glen Allen for beginner through intermediate riders. Campers get two riding classes daily plus grooming, tacking, stable care, and horse-safety lessons, and each week ends with a horse show where riders earn ribbons.',
 '11353 Rocky Ridge Road, Glen Allen, VA 23059',
 'http://tallcedarsfarm.org/day_camp.html', 37.718619972316, -77.530447879726),

('5725c5ec-9f3f-4d3e-b8ee-4fa9510953de',
 'Children''s Art Classes Summer Camps',
 'Studio art camps and workshops in Glen Allen where children work across painting, drawing, design, printmaking, sculpture, and ceramics. Small classes are grouped by age and experience, from Tiny Hands (ages 3-4) through advanced teen art.',
 '10831 West Broad Street, Glen Allen, VA 23060',
 'https://va-richmond.childrensartclasses.com/summer-camps/', 37.646584593224, -77.582378040571),

('18722a46-7989-49c0-a478-a0e159091006',
 'Let''s Grow, Henrico! Summer Camp',
 'A free summer day camp from Henrico County Recreation & Parks for rising 1st-7th graders (Henrico residents). Two-week sessions at neighborhood rec centers feature art projects, gym games, outdoor play, and special visitors; select sites also offer free meals.',
 'Henrico Recreation & Parks, 6800 Staples Mill Road, Henrico, VA 23228',
 'https://henrico.gov/rec/summer-camp/', 37.610348709045, -77.496418287087),

('69d3a631-3b80-448b-901e-aa0780145783',
 'Jacob''s Chance Summer Camps',
 'Inclusive summer camps for individuals ages 5-40 with intellectual, developmental, physical, and/or complex disabilities. A buddy system supports every camper across sports, culinary arts, visual arts, and "Explore RVA" field-trip weeks focused on skill-building, socialization, and confidence.',
 'Multiple Greater Richmond locations, VA',
 'https://www.jacobschance.org/summer-camps', 37.609414488101, -77.562114975977),

('83a5c64c-8c71-4a42-874b-b5cba5a607e3',
 'Summer Saints Day Camp',
 'St. Christopher''s School''s day camp for rising Junior Kindergarten through 6th grade. Morning Mania and Afternoon Adventures pack each week with arts and crafts, outdoor sports, pool time, BUILD projects, and games in a caring, team-focused environment.',
 '711 St. Christopher''s Road, Richmond, VA 23226',
 'https://www.stchristophers.com/summer-saints', 37.579017356527, -77.522840124429),

('5069e503-1ff4-41a8-8297-62ae98294e41',
 'Soccer Shots Richmond',
 'An engaging children''s soccer program for ages 2-8 offered at schools, childcare sites, and parks around Richmond. Half-day summer camps use creative, imaginative games to build basic soccer skills, positive character traits, and confidence.',
 '4840 Waller Road, Suite 400, Richmond, VA 23230',
 'https://www.ss-richmond.soccershots.com/page/home', 37.588823520354, -77.49190745701),

('aa28de69-e922-4807-9548-76aa1870c058',
 'River City Youth Fitness Summer Camp',
 'A movement-focused day camp in Manakin-Sabot combining organized games, obstacle courses, gymnastics, crafts, and open gym time. Weekly sessions run all summer for kids ages 5 and up.',
 '48 Plaza Drive, Manakin-Sabot, VA 23103',
 'https://www.rcyf.com/2024-summer-camps', 37.672419592234, -77.682168626491),

('a88277ac-3f06-47b9-b47f-7436f6eb6781',
 'The Center for Creative Arts Summer Camps',
 'Creative-arts camps at Shady Grove UMC in Glen Allen spanning LEGO robotics, elementary and teen studio art, fairies ballet, musical theatre, and chess. Programs are grouped by age from 5 through the early teens.',
 'Shady Grove United Methodist Church, 4825 Pouncey Tract Road, Glen Allen, VA 23059',
 'https://www.center4creativearts.org/summer-camps', 37.668706087602, -77.614075223809),

('ee817d98-de2b-421d-9a45-d4f84d83867a',
 'Hilltop Preschool Summer Camp',
 'A playful half-day summer camp for ages 3-6 in Henrico with a new theme each week — from Hawaiian Hoopla to Outer Space. Days blend music, dance, stories, crafts, and water play. Only $90/week; families can add as many weeks as they like.',
 '7612 Wanymala Road, Henrico, VA 23229',
 'https://www.hilltoppreschoolrva.com/', 37.611814681464, -77.540413963706),

('21d62463-49a2-4d18-9eba-01ed69add4da',
 'Cadence Summer Camps',
 'Musical-theatre camps for ages 4 through rising 8th grade at Maggie L. Walker Governor''s School. Over two-week "Jammin''" sessions, young performers explore acting, singing, dancing, and art on Disney and Broadway JR titles, ending in a final performance.',
 'Maggie L. Walker Governor''s School, 1000 N Lombardy Street, Richmond, VA 23220',
 'https://www.cadencetheatre.org/', 37.557081612498, -77.45349551442),

('cca0cb10-bf28-4cc0-8377-0f14d92b7f5e',
 'CCPS Immersion Language Camp',
 'Chesterfield County Public Schools'' summer language-immersion camp, offering Spanish or German immersion for students in grades 1-6. Part of the district''s in-person summer enrichment programs.',
 'Chesterfield County Public Schools, Chesterfield, VA',
 'https://www.oneccps.org/page/summer-programs', NULL, NULL),

('7b101c72-e695-47fe-8932-98070d75e9d5',
 'Camp Invention',
 'A nationally run weeklong STEM day camp for grades K-6, hosted at schools across the Richmond area and led by local educators. Hands-on, themed challenges spark creativity, confidence, and problem-solving through invention and design.',
 'Various Richmond-area schools, VA',
 'https://www.invent.org/programs/camp-invention', NULL, NULL);

-- ========================= SESSIONS =========================
-- Cub Scout Day Camp at Deep Run Park — one week, June 1-5, 2026.
INSERT INTO public.camp_sessions (camp_id, name, label, start_date, end_date, start_time, end_time, days_of_week, price, min_age, max_age, capacity) VALUES
('d175543b-2064-49ef-b12c-885a046f98a5', 'Cub Scout Day Camp', NULL, '2026-06-01', '2026-06-05', '09:00:00', '16:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 115, 5, 10, NULL);

-- Henrico Education Foundation — Adventure Lab (rising 3-6) + Exploration Labs (rising 1-6).
INSERT INTO public.camp_sessions (camp_id, name, label, start_date, end_date, start_time, end_time, days_of_week, price, min_age, max_age, capacity) VALUES
('400850a3-544b-4ca3-ad74-1bafab2dd0d7', 'Adventure Lab — Session 1', 'Tuckahoe Elementary', '2026-06-08', '2026-06-25', '08:00:00', '16:30:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 287, 8, 13, 36),
('400850a3-544b-4ca3-ad74-1bafab2dd0d7', 'Adventure Lab — Session 2', 'Tuckahoe Elementary', '2026-06-29', '2026-07-16', '08:00:00', '16:30:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 287, 8, 13, 36),
('400850a3-544b-4ca3-ad74-1bafab2dd0d7', 'Exploration Labs — Session 1', 'Colonial Trail / Greenwood Elem', '2026-06-08', '2026-06-25', '07:30:00', '17:30:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 180, 6, 13, NULL),
('400850a3-544b-4ca3-ad74-1bafab2dd0d7', 'Exploration Labs — Session 2', 'Colonial Trail / Greenwood Elem', '2026-06-29', '2026-07-16', '07:30:00', '17:30:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 180, 6, 13, NULL),
('400850a3-544b-4ca3-ad74-1bafab2dd0d7', 'Exploration Labs — Bonus Week', 'Colonial Trail / Greenwood Elem', '2026-07-20', '2026-07-23', '07:30:00', '17:30:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 180, 6, 13, NULL);

-- Passion Academy — ballet + musical theatre performance weeks.
INSERT INTO public.camp_sessions (camp_id, name, label, start_date, end_date, start_time, end_time, days_of_week, price, min_age, max_age, capacity) VALUES
('2f41f59b-7653-42bc-8a26-2e76401ee451', 'Snow White Ballet Performance (younger)', NULL, '2026-07-20', '2026-07-24', '09:00:00', '14:30:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 375, 5, 10, NULL),
('2f41f59b-7653-42bc-8a26-2e76401ee451', 'Snow White Ballet Performance (experienced)', NULL, '2026-07-27', '2026-07-31', '09:00:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 375, 8, 13, NULL),
('2f41f59b-7653-42bc-8a26-2e76401ee451', 'Mary Poppins Jr — Musical Theatre (2)', NULL, '2026-08-03', '2026-08-07', '08:30:00', '14:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 375, 6, 11, NULL),
('2f41f59b-7653-42bc-8a26-2e76401ee451', 'Mary Poppins Jr — Musical Theatre (3)', NULL, '2026-08-10', '2026-08-14', '08:30:00', '14:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 375, 6, 11, NULL);

-- Tall Cedars Farm — 6 equestrian sessions (M-Th 8:30-3, Fri 8:30-1). Price = full-day non-student rate.
INSERT INTO public.camp_sessions (camp_id, name, label, start_date, end_date, start_time, end_time, days_of_week, price, min_age, max_age, capacity) VALUES
('cdd5ff9d-6630-4f55-b554-b7a525ecde34', 'Equestrian Day Camp', 'Session 1', '2026-06-08', '2026-06-12', '08:30:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 490, 6, 16, NULL),
('cdd5ff9d-6630-4f55-b554-b7a525ecde34', 'Equestrian Day Camp', 'Session 2', '2026-06-15', '2026-06-19', '08:30:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 490, 6, 16, NULL),
('cdd5ff9d-6630-4f55-b554-b7a525ecde34', 'Equestrian Day Camp', 'Session 3', '2026-06-29', '2026-07-03', '08:30:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 490, 6, 16, NULL),
('cdd5ff9d-6630-4f55-b554-b7a525ecde34', 'Equestrian Day Camp', 'Session 4', '2026-07-06', '2026-07-10', '08:30:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 490, 6, 16, NULL),
('cdd5ff9d-6630-4f55-b554-b7a525ecde34', 'Equestrian Day Camp', 'Session 5', '2026-07-20', '2026-07-24', '08:30:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 490, 6, 16, NULL),
('cdd5ff9d-6630-4f55-b554-b7a525ecde34', 'Equestrian Day Camp', 'Session 6', '2026-07-27', '2026-07-31', '08:30:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 490, 6, 16, NULL);

-- Let's Grow, Henrico! — three free two-week sessions.
INSERT INTO public.camp_sessions (camp_id, name, label, start_date, end_date, start_time, end_time, days_of_week, price, min_age, max_age, capacity) VALUES
('18722a46-7989-49c0-a478-a0e159091006', 'Summer Camp — Session I', NULL, '2026-06-22', '2026-07-02', '08:00:00', '16:30:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 0, 6, 13, NULL),
('18722a46-7989-49c0-a478-a0e159091006', 'Summer Camp — Session II', NULL, '2026-07-06', '2026-07-16', '08:00:00', '16:30:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 0, 6, 13, NULL),
('18722a46-7989-49c0-a478-a0e159091006', 'Summer Camp — Session III', NULL, '2026-07-20', '2026-07-30', '08:00:00', '16:30:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 0, 6, 13, NULL);

-- Jacob's Chance — four themed weeks (times/ages vary; youth track hours used).
INSERT INTO public.camp_sessions (camp_id, name, label, start_date, end_date, start_time, end_time, days_of_week, price, min_age, max_age, capacity) VALUES
('69d3a631-3b80-448b-901e-aa0780145783', 'Sports Camp', 'Tuckahoe Middle / RVC Byrdhill', '2026-06-15', '2026-06-18', '09:30:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 125, 8, 40, NULL),
('69d3a631-3b80-448b-901e-aa0780145783', 'Culinary Arts Camp', 'Hope Church Lodge', '2026-06-29', '2026-07-02', '09:30:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 150, 10, 40, NULL),
('69d3a631-3b80-448b-901e-aa0780145783', 'Arts Camp', 'St. Joseph''s Villa', '2026-07-13', '2026-07-16', '09:30:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 125, 10, 40, NULL),
('69d3a631-3b80-448b-901e-aa0780145783', 'Explore RVA Camp', 'Richmond attractions', '2026-07-27', '2026-07-31', '10:00:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 150, 10, 40, NULL);

-- Summer Saints (St. Christopher's) — 8 weekly sessions; $230/wk for AM or PM half day.
INSERT INTO public.camp_sessions (camp_id, name, label, start_date, end_date, start_time, end_time, days_of_week, price, min_age, max_age, capacity) VALUES
('83a5c64c-8c71-4a42-874b-b5cba5a607e3', 'Morning Mania / Afternoon Adventures', 'Week 1', '2026-06-08', '2026-06-12', '09:00:00', '16:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 230, 4, 12, NULL),
('83a5c64c-8c71-4a42-874b-b5cba5a607e3', 'Morning Mania / Afternoon Adventures', 'Week 2', '2026-06-15', '2026-06-19', '09:00:00', '16:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 230, 4, 12, NULL),
('83a5c64c-8c71-4a42-874b-b5cba5a607e3', 'Morning Mania / Afternoon Adventures', 'Week 3', '2026-06-22', '2026-06-26', '09:00:00', '16:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 230, 4, 12, NULL),
('83a5c64c-8c71-4a42-874b-b5cba5a607e3', 'Morning Mania / Afternoon Adventures', 'Week 4', '2026-07-06', '2026-07-10', '09:00:00', '16:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 230, 4, 12, NULL),
('83a5c64c-8c71-4a42-874b-b5cba5a607e3', 'Morning Mania / Afternoon Adventures', 'Week 5', '2026-07-13', '2026-07-17', '09:00:00', '16:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 230, 4, 12, NULL),
('83a5c64c-8c71-4a42-874b-b5cba5a607e3', 'Morning Mania / Afternoon Adventures', 'Week 6', '2026-07-20', '2026-07-24', '09:00:00', '16:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 230, 4, 12, NULL),
('83a5c64c-8c71-4a42-874b-b5cba5a607e3', 'Morning Mania / Afternoon Adventures', 'Week 7', '2026-07-27', '2026-07-31', '09:00:00', '16:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 230, 4, 12, NULL),
('83a5c64c-8c71-4a42-874b-b5cba5a607e3', 'Morning Mania / Afternoon Adventures', 'Week 8', '2026-08-03', '2026-08-07', '09:00:00', '16:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], 230, 4, 12, NULL);

-- River City Youth Fitness — 10 weekly sessions (M-Th), $350/wk.
INSERT INTO public.camp_sessions (camp_id, name, label, start_date, end_date, start_time, end_time, days_of_week, price, min_age, max_age, capacity) VALUES
('aa28de69-e922-4807-9548-76aa1870c058', 'Fitness Camp', 'Week 1', '2026-06-01', '2026-06-04', '09:00:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 350, 5, 12, NULL),
('aa28de69-e922-4807-9548-76aa1870c058', 'Fitness Camp', 'Week 2', '2026-06-08', '2026-06-11', '09:00:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 350, 5, 12, NULL),
('aa28de69-e922-4807-9548-76aa1870c058', 'Fitness Camp', 'Week 3', '2026-06-15', '2026-06-18', '09:00:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 350, 5, 12, NULL),
('aa28de69-e922-4807-9548-76aa1870c058', 'Fitness Camp', 'Week 4', '2026-06-22', '2026-06-25', '09:00:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 350, 5, 12, NULL),
('aa28de69-e922-4807-9548-76aa1870c058', 'Fitness Camp', 'Week 5', '2026-07-06', '2026-07-09', '09:00:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 350, 5, 12, NULL),
('aa28de69-e922-4807-9548-76aa1870c058', 'Fitness Camp', 'Week 6', '2026-07-13', '2026-07-16', '09:00:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 350, 5, 12, NULL),
('aa28de69-e922-4807-9548-76aa1870c058', 'Fitness Camp', 'Week 7', '2026-07-20', '2026-07-23', '09:00:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 350, 5, 12, NULL),
('aa28de69-e922-4807-9548-76aa1870c058', 'Fitness Camp', 'Week 8', '2026-07-27', '2026-07-30', '09:00:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 350, 5, 12, NULL),
('aa28de69-e922-4807-9548-76aa1870c058', 'Fitness Camp', 'Week 9', '2026-08-03', '2026-08-06', '09:00:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 350, 5, 12, NULL),
('aa28de69-e922-4807-9548-76aa1870c058', 'Fitness Camp', 'Week 10', '2026-08-10', '2026-08-13', '09:00:00', '15:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 350, 5, 12, NULL);

-- Hilltop Preschool — 10 themed weeks (M-Th 9-12), $90/wk. No camp July 6-9.
INSERT INTO public.camp_sessions (camp_id, name, label, start_date, end_date, start_time, end_time, days_of_week, price, min_age, max_age, capacity) VALUES
('ee817d98-de2b-421d-9a45-d4f84d83867a', 'Hawaiian Hoopla', 'Week 1', '2026-06-08', '2026-06-11', '09:00:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 90, 3, 6, NULL),
('ee817d98-de2b-421d-9a45-d4f84d83867a', 'Dinosaur Roar', 'Week 2', '2026-06-15', '2026-06-18', '09:00:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 90, 3, 6, NULL),
('ee817d98-de2b-421d-9a45-d4f84d83867a', 'Dr. Seuss Fun', 'Week 3', '2026-06-22', '2026-06-25', '09:00:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 90, 3, 6, NULL),
('ee817d98-de2b-421d-9a45-d4f84d83867a', 'Farm Life', 'Week 4', '2026-06-29', '2026-07-02', '09:00:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 90, 3, 6, NULL),
('ee817d98-de2b-421d-9a45-d4f84d83867a', 'Backyard Bugs', 'Week 5', '2026-07-13', '2026-07-16', '09:00:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 90, 3, 6, NULL),
('ee817d98-de2b-421d-9a45-d4f84d83867a', 'Up, Up & Away', 'Week 6', '2026-07-20', '2026-07-23', '09:00:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 90, 3, 6, NULL),
('ee817d98-de2b-421d-9a45-d4f84d83867a', 'Ocean Commotion', 'Week 7', '2026-07-27', '2026-07-30', '09:00:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 90, 3, 6, NULL),
('ee817d98-de2b-421d-9a45-d4f84d83867a', 'Superheroes', 'Week 8', '2026-08-03', '2026-08-06', '09:00:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 90, 3, 6, NULL),
('ee817d98-de2b-421d-9a45-d4f84d83867a', 'Outer Space', 'Week 9', '2026-08-10', '2026-08-13', '09:00:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 90, 3, 6, NULL),
('ee817d98-de2b-421d-9a45-d4f84d83867a', 'Rainforest Explore', 'Week 10', '2026-08-17', '2026-08-20', '09:00:00', '12:00:00', ARRAY['Monday','Tuesday','Wednesday','Thursday'], 90, 3, 6, NULL);

-- (No sessions inserted for Children's Art Classes, Soccer Shots, The Center for
--  Creative Arts, Cadence, CCPS Immersion, or Camp Invention — their 2026 dates
--  are behind registration portals or were only published for a prior year.)

-- ====================== INTEREST LINKS ======================
-- interest ids: Academics cd30a5ac / Arts cee48f49 / Culinary ff0dc26b /
-- Culture 92fa74b8 / Outdoors&Nature 1233bed0 / Performing Arts dde2330a /
-- Sports fb1eeca1 / STEM 51a65b5e
INSERT INTO public.camp_interest_links (camp_id, camp_interest_id) VALUES
-- Cub Scout Day Camp: Outdoors & Nature, Sports
('d175543b-2064-49ef-b12c-885a046f98a5', '1233bed0-34d2-4446-949d-3911d2a49fc6'),
('d175543b-2064-49ef-b12c-885a046f98a5', 'fb1eeca1-1f39-48ee-a1e2-53317e554a4a'),
-- Henrico Education Foundation: Academics, Outdoors & Nature
('400850a3-544b-4ca3-ad74-1bafab2dd0d7', 'cd30a5ac-17a9-431a-a8b2-0f92bf4b3c13'),
('400850a3-544b-4ca3-ad74-1bafab2dd0d7', '1233bed0-34d2-4446-949d-3911d2a49fc6'),
-- Passion Academy: Performing Arts, Arts
('2f41f59b-7653-42bc-8a26-2e76401ee451', 'dde2330a-e9c3-47d0-9ed8-deafc72eed25'),
('2f41f59b-7653-42bc-8a26-2e76401ee451', 'cee48f49-1d61-416b-9b8c-8051629b0b13'),
-- Tall Cedars Farm: Outdoors & Nature, Sports
('cdd5ff9d-6630-4f55-b554-b7a525ecde34', '1233bed0-34d2-4446-949d-3911d2a49fc6'),
('cdd5ff9d-6630-4f55-b554-b7a525ecde34', 'fb1eeca1-1f39-48ee-a1e2-53317e554a4a'),
-- Children's Art Classes: Arts
('5725c5ec-9f3f-4d3e-b8ee-4fa9510953de', 'cee48f49-1d61-416b-9b8c-8051629b0b13'),
-- Let's Grow, Henrico!: Outdoors & Nature, Arts
('18722a46-7989-49c0-a478-a0e159091006', '1233bed0-34d2-4446-949d-3911d2a49fc6'),
('18722a46-7989-49c0-a478-a0e159091006', 'cee48f49-1d61-416b-9b8c-8051629b0b13'),
-- Jacob's Chance: Sports, Culinary, Arts, Outdoors & Nature
('69d3a631-3b80-448b-901e-aa0780145783', 'fb1eeca1-1f39-48ee-a1e2-53317e554a4a'),
('69d3a631-3b80-448b-901e-aa0780145783', 'ff0dc26b-b748-49fe-84ba-e9cd8f4f74ec'),
('69d3a631-3b80-448b-901e-aa0780145783', 'cee48f49-1d61-416b-9b8c-8051629b0b13'),
('69d3a631-3b80-448b-901e-aa0780145783', '1233bed0-34d2-4446-949d-3911d2a49fc6'),
-- Summer Saints: Sports, Arts, Outdoors & Nature
('83a5c64c-8c71-4a42-874b-b5cba5a607e3', 'fb1eeca1-1f39-48ee-a1e2-53317e554a4a'),
('83a5c64c-8c71-4a42-874b-b5cba5a607e3', 'cee48f49-1d61-416b-9b8c-8051629b0b13'),
('83a5c64c-8c71-4a42-874b-b5cba5a607e3', '1233bed0-34d2-4446-949d-3911d2a49fc6'),
-- Soccer Shots: Sports
('5069e503-1ff4-41a8-8297-62ae98294e41', 'fb1eeca1-1f39-48ee-a1e2-53317e554a4a'),
-- River City Youth Fitness: Sports
('aa28de69-e922-4807-9548-76aa1870c058', 'fb1eeca1-1f39-48ee-a1e2-53317e554a4a'),
-- The Center for Creative Arts: Arts, STEM, Performing Arts
('a88277ac-3f06-47b9-b47f-7436f6eb6781', 'cee48f49-1d61-416b-9b8c-8051629b0b13'),
('a88277ac-3f06-47b9-b47f-7436f6eb6781', '51a65b5e-11e4-4321-915b-8c628a9cc5e4'),
('a88277ac-3f06-47b9-b47f-7436f6eb6781', 'dde2330a-e9c3-47d0-9ed8-deafc72eed25'),
-- Hilltop Preschool: Arts, Outdoors & Nature
('ee817d98-de2b-421d-9a45-d4f84d83867a', 'cee48f49-1d61-416b-9b8c-8051629b0b13'),
('ee817d98-de2b-421d-9a45-d4f84d83867a', '1233bed0-34d2-4446-949d-3911d2a49fc6'),
-- Cadence: Performing Arts, Arts
('21d62463-49a2-4d18-9eba-01ed69add4da', 'dde2330a-e9c3-47d0-9ed8-deafc72eed25'),
('21d62463-49a2-4d18-9eba-01ed69add4da', 'cee48f49-1d61-416b-9b8c-8051629b0b13'),
-- CCPS Immersion Language: Culture, Academics
('cca0cb10-bf28-4cc0-8377-0f14d92b7f5e', '92fa74b8-3198-4069-9d40-0ff648845703'),
('cca0cb10-bf28-4cc0-8377-0f14d92b7f5e', 'cd30a5ac-17a9-431a-a8b2-0f92bf4b3c13'),
-- Camp Invention: STEM
('7b101c72-e695-47fe-8932-98070d75e9d5', '51a65b5e-11e4-4321-915b-8c628a9cc5e4');

-- ====================== SELF-HOSTED PHOTOS ======================
-- Self-hosted photos: each camp's card/detail/map image is a curated photo
-- downloaded from Unsplash and uploaded to the Supabase `camps_images` bucket
-- (path <id>.jpg), so ad/privacy blockers that match images.unsplash.com don't
-- hide them. campInterestImage.ts returns null for these ids so the UI serves
-- image_url below. Bucket objects are uploaded out-of-band (see the upload
-- workflow); this UPDATE only records the public URLs.
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/d175543b-2064-49ef-b12c-885a046f98a5.jpg' WHERE id='d175543b-2064-49ef-b12c-885a046f98a5'; -- Cub Scout Day Camp at Deep Run Park
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/400850a3-544b-4ca3-ad74-1bafab2dd0d7.jpg' WHERE id='400850a3-544b-4ca3-ad74-1bafab2dd0d7'; -- Henrico Education Foundation Summer Camps
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/2f41f59b-7653-42bc-8a26-2e76401ee451.jpg' WHERE id='2f41f59b-7653-42bc-8a26-2e76401ee451'; -- Passion Academy Summer Camps
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/cdd5ff9d-6630-4f55-b554-b7a525ecde34.jpg' WHERE id='cdd5ff9d-6630-4f55-b554-b7a525ecde34'; -- Tall Cedars Farm Equestrian Day Camp
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/5725c5ec-9f3f-4d3e-b8ee-4fa9510953de.jpg' WHERE id='5725c5ec-9f3f-4d3e-b8ee-4fa9510953de'; -- Children's Art Classes Summer Camps
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/18722a46-7989-49c0-a478-a0e159091006.jpg' WHERE id='18722a46-7989-49c0-a478-a0e159091006'; -- Let's Grow, Henrico! Summer Camp
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/69d3a631-3b80-448b-901e-aa0780145783.jpg' WHERE id='69d3a631-3b80-448b-901e-aa0780145783'; -- Jacob's Chance Summer Camps
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/83a5c64c-8c71-4a42-874b-b5cba5a607e3.jpg' WHERE id='83a5c64c-8c71-4a42-874b-b5cba5a607e3'; -- Summer Saints Day Camp
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/5069e503-1ff4-41a8-8297-62ae98294e41.jpg' WHERE id='5069e503-1ff4-41a8-8297-62ae98294e41'; -- Soccer Shots Richmond
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/aa28de69-e922-4807-9548-76aa1870c058.jpg' WHERE id='aa28de69-e922-4807-9548-76aa1870c058'; -- River City Youth Fitness Summer Camp
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/a88277ac-3f06-47b9-b47f-7436f6eb6781.jpg' WHERE id='a88277ac-3f06-47b9-b47f-7436f6eb6781'; -- The Center for Creative Arts Summer Camps
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/ee817d98-de2b-421d-9a45-d4f84d83867a.jpg' WHERE id='ee817d98-de2b-421d-9a45-d4f84d83867a'; -- Hilltop Preschool Summer Camp
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/21d62463-49a2-4d18-9eba-01ed69add4da.jpg' WHERE id='21d62463-49a2-4d18-9eba-01ed69add4da'; -- Cadence Summer Camps
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/cca0cb10-bf28-4cc0-8377-0f14d92b7f5e.jpg' WHERE id='cca0cb10-bf28-4cc0-8377-0f14d92b7f5e'; -- CCPS Immersion Language Camp
UPDATE public.camps SET image_url='https://smthfqpurmomutucutwt.supabase.co/storage/v1/object/public/camps_images/7b101c72-e695-47fe-8932-98070d75e9d5.jpg' WHERE id='7b101c72-e695-47fe-8932-98070d75e9d5'; -- Camp Invention

COMMIT;
