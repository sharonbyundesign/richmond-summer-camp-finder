-- Fill missing camp coordinates and images (validated + photo-vetted).
-- Run once in the Supabase SQL Editor.

-- 11 recovered coordinates (Photon/OSM, bounds-checked)
UPDATE public.camps SET latitude=37.5504943, longitude=-77.5719792 WHERE id='81449156-6ce9-40f0-a7d2-60587c1e5289'; -- Camp C.H.E.F. with Edible Education
UPDATE public.camps SET latitude=37.3639929, longitude=-77.580774 WHERE id='c4d5ec4b-aaa7-4d7b-b978-a99e54bd0f84'; -- Camp Thunderbird (YMCA)
UPDATE public.camps SET latitude=37.4087238, longitude=-77.6921886 WHERE id='9eb0fc7c-4096-4591-b947-c4743a5ac663'; -- Doodle Dynamo Art Camp
UPDATE public.camps SET latitude=37.5525712, longitude=-77.4571637 WHERE id='2cb42ecb-a7a2-40b1-8b1f-32a37f691d54'; -- Greenspring Academy of Music Summer Institutes
UPDATE public.camps SET latitude=37.5758797, longitude=-77.5412837 WHERE id='24cf8093-6096-43fc-81cc-f2209f8ee617'; -- iD Tech Camps
UPDATE public.camps SET latitude=37.5385087, longitude=-77.43428 WHERE id='b04d4aa8-741c-4f29-8a7c-c6290bc6d31b'; -- Overtime Athletics RVA
UPDATE public.camps SET latitude=37.598485, longitude=-77.4859924 WHERE id='163b966f-22bb-4096-82a3-7051156474fb'; -- Richmond Volleyball Club Camps
UPDATE public.camps SET latitude=37.5317449, longitude=-77.4301108 WHERE id='14c2b30a-f6ab-4c84-b51d-f7d69420e259'; -- RVA Paddlesports Summer Camp
UPDATE public.camps SET latitude=37.6659781, longitude=-77.506374 WHERE id='baa1a3cb-38c1-4d77-8c6f-6191bd35aeab'; -- Snapology of Glen Allen Summer Camps
UPDATE public.camps SET latitude=37.6910777, longitude=-77.436207 WHERE id='2fd8080a-967d-4470-b869-003bf54d8e7e'; -- True Black Belt Summer Camp, Ashland
UPDATE public.camps SET latitude=37.5560585, longitude=-77.4748952 WHERE id='16dcf5f5-ad71-4934-8645-2075134426dc'; -- VMFA Summer Camps

-- 23 real photos (logos/banners/graphics excluded)
UPDATE public.camps SET image_url='https://images.squarespace-cdn.com/content/v1/597775a59de4bbf784e2d4c5/583a86d0-9b20-491a-98c1-db1b88981124/Princess-Camp.jpg' WHERE id='a6825b7b-7918-4151-9951-a3a702019515'; -- Aspire Dance Academy Summer Camps
UPDATE public.camps SET image_url='https://www.bachtorock.com/wp-content/uploads/2022/07/6172db3a3ecc35e4ecef069e_bigstock-Portrait-Of-Cool-Teenage-Girl-373311823-web.png' WHERE id='91de4858-4f00-45ef-84fd-408a1020215c'; -- Bach to Rock Midlothian
UPDATE public.camps SET image_url='https://bbk12e1-cdn.myschoolcdn.com/ftpimages/289/list/large_list208529_49923.jpg' WHERE id='0d9e8c41-1d2a-4d89-b951-06c1d7b5e327'; -- Brilliant Summer at St. Catherine''''s School
UPDATE public.camps SET image_url='https://www.camphanover.org/wp-content/uploads/bug-lesson_l_web.jpg' WHERE id='c7cefda7-f9d8-4681-8139-b48413c565d0'; -- Camp Hanover
UPDATE public.camps SET image_url='https://campsensoryhouse.com/wp-content/uploads/2026/06/IMG_7663-scaled.jpeg' WHERE id='bd6ddca2-1de8-47fe-9ef4-d5b99b28c498'; -- Camp Sensory House
UPDATE public.camps SET image_url='https://tuckahoesports.org/wp-content/uploads/2025/10/Rapsodo2.jpg' WHERE id='cfec49c4-58f5-4a79-94fa-e9e8873bc104'; -- Camp Tuckahoe (Tuckahoe Sports Training Center)
UPDATE public.camps SET image_url='https://pamplinpark.org/wp-content/uploads/2020/05/Experience-Life-in-the-South.jpg' WHERE id='9cb16667-0680-43fa-965e-c3325420ee2b'; -- Civil War Adventure Camp at Pamplin Historical Park
UPDATE public.camps SET image_url='http://static1.squarespace.com/static/5b099930f7939242735bd498/t/61fcc3e9d28bcc103416caab/1756836543803/4DB38473-AF7B-4353-AE38-83B771BC0305_1_201_a.jpeg?format=1500w' WHERE id='2dda34c7-aaac-4dd7-ae8d-efcd2da728f9'; -- Discovery Center Stony Point
UPDATE public.camps SET image_url='https://www.melodymagicmusic.com/wp-content/uploads/2026/04/Summer-Camp-2.png' WHERE id='4c8cb2f1-fc26-4d0b-8610-dde4e1c714e6'; -- Melody Magic Music Summer Camps
UPDATE public.camps SET image_url='https://otathletics.com/wp-content/uploads/2025/07/Ota14.jpg' WHERE id='b04d4aa8-741c-4f29-8a7c-c6290bc6d31b'; -- Overtime Athletics RVA
UPDATE public.camps SET image_url='https://www.rightatschool.com/wp-content/uploads/2025/04/ras-kids@2x-1024x727.png' WHERE id='c23b2296-55fb-46c3-ac79-ad149d46be25'; -- RAS Camp Adventure Weeks
UPDATE public.camps SET image_url='https://www.richmondfencing.com/images/camp.png' WHERE id='f5cd9f4c-d587-49a7-92e0-f086e813349a'; -- Richmond Fencing Club Summer Camp
UPDATE public.camps SET image_url='https://cdn.prod.website-files.com/67c398389d3a80fef8650ba0/67ce48f5b739de8fc2936734_sc-about-1.avif' WHERE id='55327b36-491c-454f-ad1d-f2c598cfbac2'; -- RISE Martial Arts Summer Camp
UPDATE public.camps SET image_url='https://static.wixstatic.com/media/d418b5_976c4b54fdd04751aa4b731c68dad125~mv2.jpg/v1/fill/w_2500,h_1666,al_c/d418b5_976c4b54fdd04751aa4b731c68dad125~mv2.jpg' WHERE id='57bd1cd2-cf11-413b-a05d-ce1c54e7cda6'; -- RITS Summer Camp
UPDATE public.camps SET image_url='https://images.squarespace-cdn.com/content/v1/68c8f4c3370dc72979aaad29/fb28a4ec-f0af-48e0-bb5c-09e4862fec7d/basketball-game-at-rockit.png' WHERE id='7a684f06-4d3a-4e84-a434-8849ed5245a6'; -- RockIt Sports
UPDATE public.camps SET image_url='https://rvapaddlesports.com/wp-content/uploads/sites/4066/2025/01/IMG_5756-e1739468808109.jpg?w=700&h=700&zoom=2' WHERE id='14c2b30a-f6ab-4c84-b51d-f7d69420e259'; -- RVA Paddlesports Summer Camp
UPDATE public.camps SET image_url='https://scor-richmond.com/wp-content/uploads/2020/01/IMG_5473-2.jpg' WHERE id='cd6dcce9-e1e9-46a6-9771-93c32cf07005'; -- SCOR Summer Camp
UPDATE public.camps SET image_url='https://static.wixstatic.com/media/38f83c_a85a6aa4efb44173be0501ed480dd994~mv2.jpg/v1/fill/w_1416,h_1010,al_c/38f83c_a85a6aa4efb44173be0501ed480dd994~mv2.jpg' WHERE id='179d9f59-0681-48b8-a1cf-5c828fe4c42f'; -- STEAM Discovery Academy
UPDATE public.camps SET image_url='https://img1.wsimg.com/isteam/getty/1770527557' WHERE id='2fd8080a-967d-4470-b869-003bf54d8e7e'; -- True Black Belt Summer Camp, Ashland
UPDATE public.camps SET image_url='https://img1.wsimg.com/isteam/getty/1770527557' WHERE id='becfd372-9b27-4e8c-9ec7-07829ec41571'; -- True Black Belt Summer Camp, Glen Allen
UPDATE public.camps SET image_url='https://richmondspiderscamps.com/imgs/CRIC_ATH_LP_Hero.jpg' WHERE id='9c1579df-7631-4c9a-ad84-3c740d7953ae'; -- University of Richmond Summer Swim Clinic
UPDATE public.camps SET image_url='https://virginia-outside.s3.amazonaws.com/wp-content/uploads/2019/12/22190632/richmond-2.jpg' WHERE id='cb9e9ae9-5c24-411f-a6d1-12e34d6a02ee'; -- Virginia Outside
UPDATE public.camps SET image_url='https://youngchefsacademy.com/wp-content/uploads/2025/02/Culinary-Camps.jpg' WHERE id='38f94d13-13c4-40cf-a3cd-ed032788a12d'; -- Young Chefs Academy Richmond
