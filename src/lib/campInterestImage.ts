// Card/thumbnail photos, keyed off a camp's interests.
//
// Each camp's card, map popup and detail hero shows a stock photo chosen from
// its interest: a pool per canonical interest category, plus a "multi-activity"
// pool for camps that span two or more categories. The specific photo is picked
// deterministically from the pool by camp id, so the same category doesn't show
// an identical photo on every card (which reads as a bug) but a given camp
// always shows the same one.
//
// Photos are hotlinked from Unsplash's CDN (images.unsplash.com); the Unsplash
// License permits free hotlinked use. Curated 2026-07-14 — see the source query
// in each pool's comment. This replaced the earlier flat category illustrations.

import { toCategories } from './interest-categories';

type RawInterest = { tag?: string; interest_name?: string } | string | null | undefined;

// Unsplash photo slugs (the "photo-…" path segment). 3 per pool for variety.
// Keys must match the canonical names in INTEREST_CATEGORIES exactly.
const PHOTOS_BY_CATEGORY: Record<string, string[]> = {
  // kids-science-experiment
  STEM: [
    'photo-1633828763399-e29f1cd3f4c1',
    'photo-1613271752699-ede48a285196',
    'photo-1658387575638-026450e4df6e',
  ],
  // child-painting-art
  Arts: [
    'photo-1560421683-6856ea585c78',
    'photo-1510832842230-87253f48d74f',
    'photo-1607211851821-8be3cd6146f0',
  ],
  // children-dance-performance (people on stage, not empty stages)
  'Performing Arts': [
    'photo-1576724196706-3f23f51ea351',
    'photo-1522642888367-8d98750c243c',
    'photo-1667386427340-ea2cbca9ad01',
  ],
  // kids-playing-soccer
  Sports: [
    'photo-1622659097509-4d56de14539e',
    'photo-1622659097972-68f1d8c1829f',
    'photo-1598880513655-d1c6d4b2dfbf',
  ],
  // summer-camp-nature-outdoors
  'Outdoors & Nature': [
    'photo-1533873984035-25970ab07461',
    'photo-1750167306030-c5ed63560b22',
    'photo-1545572695-789c1407474c',
  ],
  // children-reading-books
  Academics: [
    'photo-1599689868384-59cb2b01bb21',
    'photo-1516042438821-0abd7a73c4b3',
    'photo-1554721299-e0b8aa7666ce',
  ],
  // kids-cooking-class
  Culinary: [
    'photo-1605433247501-698725862cea',
    'photo-1579938202767-771be803237b',
    'photo-1634393305859-dfb151e2fd54',
  ],
  // cultural-festival-world
  Culture: [
    'photo-1667984849405-9d779b049d74',
    'photo-1639369501176-f40a0641c91f',
    'photo-1533551268962-824e232f7ee1',
  ],
};

// children-summer-camp-activities — shown when a camp spans 2+ categories.
const MULTI_PHOTOS = [
  'photo-1606092195730-5d7b9af1efc5',
  'photo-1533222481259-ce20eda1e20b',
  'photo-1563902315161-7d8184684f79',
];

// Hand-picked photo overrides, keyed by camp id. These win over the interest
// pools below — Sharon chose a specific Unsplash photo for each of these camps.
// (Two-location brands share one photo: both Bella Ballerina locations, both
// True Black Belt locations, both School of Rock locations.)
const PHOTO_BY_CAMP_ID: Record<string, string> = {
  '370cf10c-6876-403e-916f-01bfefcb6cb2': 'photo-1498747946579-bde604cb8f44', // ACAC Midlothian
  '060bfd6d-0cba-4616-989d-d6eae1454512': 'photo-1621004612697-2b177e183326', // Bella Ballerina, Chesterfield
  '8904e113-9f8c-4515-a3d9-298fc57e0473': 'photo-1621004612697-2b177e183326', // Bella Ballerina, Short Pump
  '91de4858-4f00-45ef-84fd-408a1020215c': 'photo-1519076976365-9c64dbd98317', // Bach to Rock Midlothian
  '4d70fd67-0c63-47f4-8bbc-1467e04cbf51': 'photo-1569616813007-8dede61a698e', // Blue Sky Fund Outdoor Leadership Institute
  '4fed686d-59c3-4c3e-9664-bdfe1363cc23': 'photo-1631106256072-54c89defe828', // Bricks 4 Kidz Richmond
  '0d9e8c41-1d2a-4d89-b951-06c1d7b5e327': 'photo-1594913495702-0872744c6968', // Brilliant Summer
  '1943d3dc-d1c3-438b-98d1-6e2e9cb029ab': 'photo-1464692805480-a69dfaafdb0d', // Camp Baker at SOAR 365
  'bd6ddca2-1de8-47fe-9ef4-d5b99b28c498': 'photo-1587786255280-7836bf020cd6', // Camp Sensory House
  'cfec49c4-58f5-4a79-94fa-e9e8873bc104': 'photo-1508344928928-7165b67de128', // Camp Tuckahoe
  '9cb16667-0680-43fa-965e-c3325420ee2b': 'photo-1506845347893-bc5faede1eec', // Civil War Adventure Camp
  '54cdbc57-f361-4ac9-af1f-00b285d63309': 'photo-1780006393664-142ed57a1593', // Club SciKidz / Tech Scientific
  '15844129-6b4b-49fc-829c-a6f201c83ef1': 'photo-1617117206620-b01f2919ff86', // Collegiate School
  '84c3bd65-ee40-43be-9cc6-3210eafd795e': 'photo-1738658024539-a8d1527fa8e8', // Comedy Sportz
  'd65f5f76-fcc2-43db-bf8e-1603e57e4040': 'photo-1655842556539-db2d2099ded1', // Core Kids Academy
  'f48735d4-2a32-4233-84ff-3fce19135f3c': 'photo-1613950190144-4f2a84c75e8c', // Cultural Arts Center at Glen Allen
  '2dda34c7-aaac-4dd7-ae8d-efcd2da728f9': 'photo-1490383559880-5003a7baa963', // Discovery Center Stony Point
  '9eb0fc7c-4096-4591-b947-c4743a5ac663': 'photo-1572265223084-9612f11e7990', // Doodle Dynamo Art Camp
  '000b00e9-2b1d-4b59-b00b-a1f66a73bd0d': 'photo-1602957417690-53488d19faa4', // First Tee Greater Richmond
  '2cb42ecb-a7a2-40b1-8b1f-32a37f691d54': 'flagged/photo-1567116681178-c326fa4e2c8b', // Greenspring Academy of Music Summer Institutes
  '7eb42b3b-bf37-4c28-8b9e-5e719660f804': 'photo-1678027783638-345d5041b529', // GRSM Summer Music Camps
  '3c7ab356-fbb0-4ac6-9e47-3c279f983a86': 'photo-1605202764282-89f3fbce5c16', // James River Association
  '45d17c65-a8f5-49cc-ae9c-6172c704ee01': 'photo-1490750967868-88aa4486c946', // Lewis Ginter Botanical Garden
  '6a34e1d8-c5bc-4ce3-82f6-35cf2c8d8079': 'photo-1653015503992-347de54a8125', // M14 Hoops
  'b0282852-a5b6-4202-9e74-c0fd6cc4c41f': 'photo-1656653121526-a1458317b790', // Master Cho's Tae Kwon Do
  '4321d3bd-2b8d-44bd-8f0b-94d71affca82': 'photo-1597117903702-fb2788ddf816', // Maymont Summer Discovery
  '4c8cb2f1-fc26-4d0b-8610-dde4e1c714e6': 'photo-1774624345025-f73936b94dbf', // Melody Magic Music
  'dae06ca2-aa27-420f-ae5f-b5a3119b52a3': 'photo-1565687981296-535f09db714e', // Minecraft, Roblox, Game Design
  'a78be5cc-be7e-4100-8e12-d73d8746abce': 'photo-1711048421235-3fcb9dcf82f7', // Mosley Music Camps
  'f918c545-8ddc-42a0-80ec-e5991911b641': 'photo-1530560643359-6d2fead989b3', // My Taekwondo Summer Camp
  'aab87506-1ef6-4e08-9d18-9884caf9769e': 'photo-1587683437362-da7775ffc532', // Nike Tennis Camp at VCU
  'b04d4aa8-741c-4f29-8a7c-c6290bc6d31b': 'photo-1571008592377-e362723e8998', // Overtime Athletics RVA
  '8b51275e-df82-4241-a196-6b3323c0e88c': 'photo-1617096000801-bd71df8d6d8f', // Pactamere Farm
  '92916235-6426-4272-92f3-e6242a87c399': 'photo-1659666287295-7da26c3f80d4', // Passages Adventure Camp
  '41d1cede-0475-476b-9342-68a54b87fff2': 'photo-1730127143739-9dc06877bb7f', // Pipeline Adventure Camp
  'c23b2296-55fb-46c3-ac79-ad149d46be25': 'photo-1489710437720-ebb67ec84dd2', // RAS Camp Adventure Weeks
  '64c3fe49-80cb-444d-aa0c-fc63acc8541a': 'photo-1524594152303-9fd13543fe6e', // Releve RVA
  'f5cd9f4c-d587-49a7-92e0-f086e813349a': 'photo-1505619656705-59ebc350b547', // Richmond Fencing Club
  '8843bb79-b66d-4720-b949-eb1ea2b3aa81': 'photo-1601979031925-424e53b6caaa', // Richmond SPCA Critter Camp
  'b6d49dfb-6d96-47c0-8d09-d2afc69aeca1': 'flagged/photo-1568127539877-487e4825ec58', // Richmond Spider Soccer Summer Camps
  '163b966f-22bb-4096-82a3-7051156474fb': 'photo-1592656094267-764a45160876', // Richmond Volleyball Club
  '55327b36-491c-454f-ad1d-f2c598cfbac2': 'photo-1555597673-b21d5c935865', // RISE Martial Arts
  '57bd1cd2-cf11-413b-a05d-ce1c54e7cda6': 'photo-1564325724739-bae0bd08762c', // RITS Summer Camp
  '2ce1c62e-7dea-4fc3-ab56-82e334dfdda1': 'photo-1707991115462-b0165a7ec227', // Riverside Outfitters
  '7a684f06-4d3a-4e84-a434-8849ed5245a6': 'photo-1546519638-68e109498ffc', // RockIt Sports
  '14c2b30a-f6ab-4c84-b51d-f7d69420e259': 'photo-1588472235276-7638965471e2', // RVA Paddlesports
  'c1855ea1-26c0-4ae2-8004-00976df8d2a9': 'photo-1708961465136-e24550f3acd5', // School of Rock Midlothian
  '73b82ad4-4689-47b4-8362-af7ec161661f': 'photo-1708961465136-e24550f3acd5', // School of Rock Short Pump
  'cd6dcce9-e1e9-46a6-9771-93c32cf07005': 'photo-1579952363873-27f3bade9f55', // SCOR Summer Camp
  'd4042189-b6fb-47f8-a4bd-8b72b7099583': 'photo-1682953390639-381112a2c4f0', // SkateNation Plus
  'baa1a3cb-38c1-4d77-8c6f-6191bd35aeab': 'photo-1566140967404-b8b3932483f5', // Snapology of Glen Allen
  '5d0c9777-3fb6-436c-acdc-52aa44c0a123': 'photo-1612078311896-bc64c28a6749', // SPARC Summer
  '352a26c4-f524-4452-b5c1-e953a2fa9f8f': 'photo-1639682687087-721b80c5538b', // Spotlights Camp
  'e46f66f1-5742-4e8b-bc27-971ce6dfa94a': 'photo-1667386428097-74781c692dfb', // Stage Explorers Camp
  'cae877fe-fdca-4546-822a-7493c56c5f31': 'photo-1503454537195-1dcabb73ffb9', // St. Michael's Episcopal School
  'c4031cda-e541-4642-bf49-d78288d63450': 'photo-1469406396016-013bfae5d83e', // Steward Summer Experience
  '2874f321-7f08-4ca8-b893-6398ae4c35b4': 'photo-1512253080918-79cf0c2e0650', // Summer Art Camp at Atlee Art Loft
  '00befc88-c397-40d5-aa78-ef533bb2243a': 'photo-1551401107-5d806c2909a6', // Summer Art Camp at Flow Zone RVA
  '5456b226-926f-40f6-b22e-55fecc4961c7': 'photo-1527430253228-e93688616381', // Sylvan Edge Camps
  '03916606-8fbc-4883-b8eb-c33b76362471': 'photo-1634128221889-82ed6efebfc3', // The Language Hub
  '2a6bf5a7-49e8-4c6c-98d9-45d8c096f409': 'photo-1568126709698-2c92f8831a70', // Thrive Arts Summer Camps
  '2fd8080a-967d-4470-b869-003bf54d8e7e': 'photo-1656653121475-e33829581294', // True Black Belt, Ashland
  'becfd372-9b27-4e8c-9ec7-07829ec41571': 'photo-1656653121475-e33829581294', // True Black Belt, Glen Allen
  '2d72a18d-7729-46ae-b62a-4095ddb206b9': 'photo-1655842556563-2c28adb3fcc5', // Twist Gymnastics
  '9c1579df-7631-4c9a-ad84-3c740d7953ae': 'photo-1574744918163-6cef6f4a31b0', // University of Richmond Swim
  '1b282a9f-a13d-4daf-96e7-0cb4c8d51cb0': 'photo-1524621880920-5a6a9a3b239e', // Unscripted Fun
  'cb9e9ae9-5c24-411f-a6d1-12e34d6a02ee': 'photo-1613002864759-130aad1f3e99', // Virginia Outside
  '11ee2bb2-3e47-4438-b343-5e3286cd20dc': 'photo-1702523848807-6069524380eb', // Virginia Repertory Theatre Camps
  'c3c9d422-4df3-4677-986b-97e91d07df79': 'photo-1708795921259-263a5e973acb', // Visual Arts Center of Richmond Summer Camps
  '16dcf5f5-ad71-4934-8645-2075134426dc': 'photo-1459908676235-d5f02a50184b', // VMFA Summer Camps
  '72d9c37c-5704-427d-8641-0411b95718f8': 'photo-1779398422654-ea500a9649c3', // YMCA of Greater Richmond Summer Camp
  '38f94d13-13c4-40cf-a3cd-ed032788a12d': 'photo-1769720205199-ac0d647e7fca', // Young Chefs Academy Richmond
  '3ba98e8c-6271-4101-a7d9-e6b80d67d8a9': 'photo-1667384439505-b2a5a1486dfe', // Young Performers Institute
  // 2026 batch 2 (added 2026-07-24)
  'd175543b-2064-49ef-b12c-885a046f98a5': 'photo-1533873984035-25970ab07461', // Cub Scout Day Camp at Deep Run Park
  '400850a3-544b-4ca3-ad74-1bafab2dd0d7': 'photo-1606092195730-5d7b9af1efc5', // Henrico Education Foundation Summer Camps
  '2f41f59b-7653-42bc-8a26-2e76401ee451': 'photo-1576724196706-3f23f51ea351', // Passion Academy Summer Camps
  'cdd5ff9d-6630-4f55-b554-b7a525ecde34': 'photo-1553284965-83fd3e82fa5a', // Tall Cedars Farm Equestrian Day Camp
  '5725c5ec-9f3f-4d3e-b8ee-4fa9510953de': 'photo-1560421683-6856ea585c78', // Children's Art Classes Summer Camps
  '18722a46-7989-49c0-a478-a0e159091006': 'photo-1533222481259-ce20eda1e20b', // Let's Grow, Henrico! Summer Camp
  '69d3a631-3b80-448b-901e-aa0780145783': 'photo-1563902315161-7d8184684f79', // Jacob's Chance Summer Camps
  '83a5c64c-8c71-4a42-874b-b5cba5a607e3': 'photo-1489710437720-ebb67ec84dd2', // Summer Saints Day Camp
  '5069e503-1ff4-41a8-8297-62ae98294e41': 'photo-1622659097509-4d56de14539e', // Soccer Shots Richmond
  'aa28de69-e922-4807-9548-76aa1870c058': 'photo-1655842556563-2c28adb3fcc5', // River City Youth Fitness Summer Camp
  'a88277ac-3f06-47b9-b47f-7436f6eb6781': 'photo-1512253080918-79cf0c2e0650', // The Center for Creative Arts Summer Camps
  'ee817d98-de2b-421d-9a45-d4f84d83867a': 'photo-1596464716127-f2a82984de30', // Hilltop Preschool Summer Camp
  '21d62463-49a2-4d18-9eba-01ed69add4da': 'photo-1522642888367-8d98750c243c', // Cadence Summer Camps
  'cca0cb10-bf28-4cc0-8377-0f14d92b7f5e': 'photo-1634128221889-82ed6efebfc3', // CCPS Immersion Language Camp
  '7b101c72-e695-47fe-8932-98070d75e9d5': 'photo-1633828763399-e29f1cd3f4c1', // Camp Invention
};

// Landscape crop that suits the card (h-44), map popup (h-24) and detail hero
// (aspect-video), all of which object-cover.
const UNSPLASH_PARAMS = 'w=800&h=450&fit=crop&crop=faces,center&q=75&auto=format';

function photoUrl(slug: string): string {
  return `https://images.unsplash.com/${slug}?${UNSPLASH_PARAMS}`;
}

// Small deterministic string hash so a given camp always maps to the same photo.
function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Public URL of the photo for a camp. A hand-picked override wins if one exists
 * for the camp id; otherwise a photo is chosen from the camp's interest pool.
 * Returns null only when the camp has neither an override nor a recognised
 * interest (callers fall back to their placeholder). `campId` also seeds which
 * pool photo is used, so it stays stable per camp.
 */
export function campInterestImageUrl(
  campId: string,
  interests?: RawInterest[],
): string | null {
  const override = PHOTO_BY_CAMP_ID[campId];
  if (override) return photoUrl(override);

  const raws = (interests || []).map((i) =>
    typeof i === 'string' ? i : i?.tag ?? i?.interest_name,
  );
  const categories = toCategories(raws);
  if (categories.length === 0) return null;

  const pool =
    categories.length > 1
      ? MULTI_PHOTOS
      : PHOTOS_BY_CATEGORY[categories[0]] ?? MULTI_PHOTOS;

  return photoUrl(pool[hash(campId) % pool.length]);
}
