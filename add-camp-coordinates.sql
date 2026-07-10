-- Adds and populates latitude/longitude for the camps table.
-- Run once in the Supabase SQL Editor.

ALTER TABLE public.camps
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Coordinates for 79 camps (geocoded via US Census). The rest have
-- vague/multi-site addresses and fall back to browser geocoding.
UPDATE public.camps SET latitude=37.45060705825, longitude=-77.647204112402 WHERE id='370cf10c-6876-403e-916f-01bfefcb6cb2';
UPDATE public.camps SET latitude=37.643112932224, longitude=-77.509103793682 WHERE id='0b2bc078-2a2d-4836-8647-f11396c6f121';
UPDATE public.camps SET latitude=37.424062034593, longitude=-77.63649703485 WHERE id='bc7b3232-2f0c-46b8-b869-5932a3e160a8';
UPDATE public.camps SET latitude=37.668279339075, longitude=-77.692690483396 WHERE id='a6825b7b-7918-4151-9951-a3a702019515';
UPDATE public.camps SET latitude=37.52394257144, longitude=-77.607229814921 WHERE id='91de4858-4f00-45ef-84fd-408a1020215c';
UPDATE public.camps SET latitude=37.40525362259, longitude=-77.662178861343 WHERE id='060bfd6d-0cba-4616-989d-d6eae1454512';
UPDATE public.camps SET latitude=37.639942561183, longitude=-77.587799867098 WHERE id='8904e113-9f8c-4515-a3d9-298fc57e0473';
UPDATE public.camps SET latitude=37.541966973858, longitude=-77.400750414915 WHERE id='4d70fd67-0c63-47f4-8bbc-1467e04cbf51';
UPDATE public.camps SET latitude=37.572787452042, longitude=-77.52080349454 WHERE id='0d9e8c41-1d2a-4d89-b951-06c1d7b5e327';
UPDATE public.camps SET latitude=37.368793335266, longitude=-77.515829174923 WHERE id='1943d3dc-d1c3-438b-98d1-6e2e9cb029ab';
UPDATE public.camps SET latitude=37.603011796544, longitude=-77.207721803083 WHERE id='c7cefda7-f9d8-4681-8139-b48413c565d0';
UPDATE public.camps SET latitude=37.552545600089, longitude=-77.447375624502 WHERE id='bd6ddca2-1de8-47fe-9ef4-d5b99b28c498';
UPDATE public.camps SET latitude=37.625400621964, longitude=-77.626417442829 WHERE id='cfec49c4-58f5-4a79-94fa-e9e8873bc104';
UPDATE public.camps SET latitude=37.559698207701, longitude=-77.447898653732 WHERE id='753ea0ea-d058-4841-a4c7-882dc9ab0cfe';
UPDATE public.camps SET latitude=37.186202304727, longitude=-77.481678627032 WHERE id='9cb16667-0680-43fa-965e-c3325420ee2b';
UPDATE public.camps SET latitude=37.448803347265, longitude=-77.492010235257 WHERE id='15844129-6b4b-49fc-829c-a6f201c83ef1';
UPDATE public.camps SET latitude=37.654594629017, longitude=-77.623569326688 WHERE id='84c3bd65-ee40-43be-9cc6-3210eafd795e';
UPDATE public.camps SET latitude=37.605052693299, longitude=-77.570167167098 WHERE id='d65f5f76-fcc2-43db-bf8e-1603e57e4040';
UPDATE public.camps SET latitude=37.665262005056, longitude=-77.499462022095 WHERE id='f48735d4-2a32-4233-84ff-3fce19135f3c';
UPDATE public.camps SET latitude=37.551006538414, longitude=-77.574236841259 WHERE id='2dda34c7-aaac-4dd7-ae8d-efcd2da728f9';
UPDATE public.camps SET latitude=37.523908784166, longitude=-77.432775479378 WHERE id='000b00e9-2b1d-4b59-b00b-a1f66a73bd0d';
UPDATE public.camps SET latitude=37.649499338847, longitude=-77.405858233254 WHERE id='7eb42b3b-bf37-4c28-8b9e-5e719660f804';
UPDATE public.camps SET latitude=37.762780046111, longitude=-77.365522276699 WHERE id='1042aaca-5048-4420-b200-1513fc7af375';
UPDATE public.camps SET latitude=37.610348709045, longitude=-77.496418287087 WHERE id='c8d98142-d4a3-4ba2-bffe-d8bd0741525f';
UPDATE public.camps SET latitude=37.533318454048, longitude=-77.428714716885 WHERE id='3c7ab356-fbb0-4ac6-9e47-3c279f983a86';
UPDATE public.camps SET latitude=37.620874568397, longitude=-77.46844980291 WHERE id='45d17c65-a8f5-49cc-ae9c-6172c704ee01';
UPDATE public.camps SET latitude=37.65609042558, longitude=-77.611599139816 WHERE id='b0282852-a5b6-4202-9e74-c0fd6cc4c41f';
UPDATE public.camps SET latitude=37.538945173406, longitude=-77.478752903867 WHERE id='4321d3bd-2b8d-44bd-8f0b-94d71affca82';
UPDATE public.camps SET latitude=37.637740719962, longitude=-77.633301043313 WHERE id='4c8cb2f1-fc26-4d0b-8610-dde4e1c714e6';
UPDATE public.camps SET latitude=37.646559573577, longitude=-77.582182887397 WHERE id='dae06ca2-aa27-420f-ae5f-b5a3119b52a3';
UPDATE public.camps SET latitude=37.692311115352, longitude=-77.435956150395 WHERE id='a78be5cc-be7e-4100-8e12-d73d8746abce';
UPDATE public.camps SET latitude=37.672507748093, longitude=-77.682078707515 WHERE id='f918c545-8ddc-42a0-80ec-e5991911b641';
UPDATE public.camps SET latitude=37.544559642313, longitude=-77.453132831549 WHERE id='aab87506-1ef6-4e08-9d18-9884caf9769e';
UPDATE public.camps SET latitude=37.729808838716, longitude=-77.642960464488 WHERE id='8b51275e-df82-4241-a196-6b3323c0e88c';
UPDATE public.camps SET latitude=37.526667727686, longitude=-77.609803866452 WHERE id='92916235-6426-4272-92f3-e6242a87c399';
UPDATE public.camps SET latitude=37.52320763134, longitude=-77.47095755375 WHERE id='41d1cede-0475-476b-9342-68a54b87fff2';
UPDATE public.camps SET latitude=37.667485493542, longitude=-77.340136686978 WHERE id='c23b2296-55fb-46c3-ac79-ad149d46be25';
UPDATE public.camps SET latitude=37.497729514879, longitude=-77.56857037182 WHERE id='64c3fe49-80cb-444d-aa0c-fc63acc8541a';
UPDATE public.camps SET latitude=37.573161618691, longitude=-77.516988372568 WHERE id='58173cb1-e9c8-465d-85d6-4c7dfa99d1f3';
UPDATE public.camps SET latitude=37.539072417504, longitude=-77.442370593019 WHERE id='0636a242-61db-4038-b60d-ba8ac1741731';
UPDATE public.camps SET latitude=37.545128043365, longitude=-77.447956325774 WHERE id='b1ceacd5-3ce0-426e-b051-e22340b0733a';
UPDATE public.camps SET latitude=37.572603835544, longitude=-77.470569170479 WHERE id='f5cd9f4c-d587-49a7-92e0-f086e813349a';
UPDATE public.camps SET latitude=37.5657043599, longitude=-77.460403147583 WHERE id='8843bb79-b66d-4720-b949-eb1ea2b3aa81';
UPDATE public.camps SET latitude=37.575903364334, longitude=-77.542210585065 WHERE id='b6d49dfb-6d96-47c0-8d09-d2afc69aeca1';
UPDATE public.camps SET latitude=37.551169017283, longitude=-77.475275961406 WHERE id='cef48e33-62eb-4a10-83aa-bdb979fe472a';
UPDATE public.camps SET latitude=37.760049786476, longitude=-77.471468817262 WHERE id='55327b36-491c-454f-ad1d-f2c598cfbac2';
UPDATE public.camps SET latitude=37.545744466698, longitude=-77.449152245215 WHERE id='57bd1cd2-cf11-413b-a05d-ce1c54e7cda6';
UPDATE public.camps SET latitude=37.538687686953, longitude=-77.520334118037 WHERE id='2ce1c62e-7dea-4fc3-ab56-82e334dfdda1';
UPDATE public.camps SET latitude=37.628887969324, longitude=-77.543918767344 WHERE id='7a684f06-4d3a-4e84-a434-8849ed5245a6';
UPDATE public.camps SET latitude=37.502746070267, longitude=-77.608948131446 WHERE id='275c94ff-19d8-4275-bbbc-47f774391d2b';
UPDATE public.camps SET latitude=37.641283096618, longitude=-77.562301295995 WHERE id='0166ddbc-9a6f-49df-8038-1f4c16af74c7';
UPDATE public.camps SET latitude=37.418779410619, longitude=-77.630878878441 WHERE id='c1855ea1-26c0-4ae2-8004-00976df8d2a9';
UPDATE public.camps SET latitude=37.654989042731, longitude=-77.611425578196 WHERE id='73b82ad4-4689-47b4-8362-af7ec161661f';
UPDATE public.camps SET latitude=37.559655804019, longitude=-77.465157824494 WHERE id='e49fa5db-3548-488d-b0c2-b5fc18b4023b';
UPDATE public.camps SET latitude=37.565284390135, longitude=-77.45482616041 WHERE id='cd6dcce9-e1e9-46a6-9771-93c32cf07005';
UPDATE public.camps SET latitude=37.655629347419, longitude=-77.611528441198 WHERE id='d4042189-b6fb-47f8-a4bd-8b72b7099583';
UPDATE public.camps SET latitude=37.576371999812, longitude=-77.474646972693 WHERE id='5d0c9777-3fb6-436c-acdc-52aa44c0a123';
UPDATE public.camps SET latitude=37.546373454546, longitude=-77.442922344487 WHERE id='352a26c4-f524-4452-b5c1-e953a2fa9f8f';
UPDATE public.camps SET latitude=37.541796948659, longitude=-77.588888457159 WHERE id='cae877fe-fdca-4546-822a-7493c56c5f31';
UPDATE public.camps SET latitude=37.506033119875, longitude=-77.498440807444 WHERE id='e46f66f1-5742-4e8b-bc27-971ce6dfa94a';
UPDATE public.camps SET latitude=37.532071787964, longitude=-77.593717924829 WHERE id='179d9f59-0681-48b8-a1cf-5c828fe4c42f';
UPDATE public.camps SET latitude=37.611103024991, longitude=-77.622461270275 WHERE id='c4031cda-e541-4642-bf49-d78288d63450';
UPDATE public.camps SET latitude=37.687846771907, longitude=-77.430259428643 WHERE id='2874f321-7f08-4ca8-b893-6398ae4c35b4';
UPDATE public.camps SET latitude=37.601348697276, longitude=-77.564109565757 WHERE id='00befc88-c397-40d5-aa78-ef533bb2243a';
UPDATE public.camps SET latitude=37.605110301638, longitude=-77.540570966758 WHERE id='23ecce43-c33f-4879-83ca-1c7194a349e8';
UPDATE public.camps SET latitude=37.416954040541, longitude=-77.628936663023 WHERE id='5456b226-926f-40f6-b22e-55fecc4961c7';
UPDATE public.camps SET latitude=37.676176468804, longitude=-77.58920957984 WHERE id='03916606-8fbc-4883-b8eb-c33b76362471';
UPDATE public.camps SET latitude=37.655034898442, longitude=-77.402937448047 WHERE id='2a6bf5a7-49e8-4c6c-98d9-45d8c096f409';
UPDATE public.camps SET latitude=37.683280047615, longitude=-77.589417934027 WHERE id='becfd372-9b27-4e8c-9ec7-07829ec41571';
UPDATE public.camps SET latitude=37.579429730147, longitude=-77.481930126584 WHERE id='2d72a18d-7729-46ae-b62a-4095ddb206b9';
UPDATE public.camps SET latitude=37.575903364334, longitude=-77.542210585065 WHERE id='9c1579df-7631-4c9a-ad84-3c740d7953ae';
UPDATE public.camps SET latitude=37.541544549459, longitude=-77.43727855686 WHERE id='1b282a9f-a13d-4daf-96e7-0cb4c8d51cb0';
UPDATE public.camps SET latitude=37.543749190347, longitude=-77.482158398649 WHERE id='3b6cf290-088f-46aa-90ac-13263161e7a4';
UPDATE public.camps SET latitude=37.516720968582, longitude=-77.474831238468 WHERE id='cb9e9ae9-5c24-411f-a6d1-12e34d6a02ee';
UPDATE public.camps SET latitude=37.546373454546, longitude=-77.442922344487 WHERE id='11ee2bb2-3e47-4438-b343-5e3286cd20dc';
UPDATE public.camps SET latitude=37.548454356186, longitude=-77.463566741542 WHERE id='c3c9d422-4df3-4677-986b-97e91d07df79';
UPDATE public.camps SET latitude=37.581122849024, longitude=-77.506112326562 WHERE id='98ee7cb9-2bae-4ed5-ae71-4c344024d665';
UPDATE public.camps SET latitude=37.650024306159, longitude=-77.605866296788 WHERE id='38f94d13-13c4-40cf-a3cd-ed032788a12d';
UPDATE public.camps SET latitude=37.546373454546, longitude=-77.442922344487 WHERE id='3ba98e8c-6271-4101-a7d9-e6b80d67d8a9';
