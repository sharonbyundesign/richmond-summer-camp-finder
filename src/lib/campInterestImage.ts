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

// Landscape crop that suits the card (h-44), map popup (h-24) and detail hero
// (aspect-video), all of which object-cover.
const UNSPLASH_PARAMS = 'w=800&h=450&fit=crop&crop=faces,center&q=75&auto=format';

// Small deterministic string hash so a given camp always maps to the same photo.
function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Public URL of the interest photo for a camp, or null when the camp has no
 * recognised interest (callers fall back to their placeholder). `campId` only
 * seeds which photo in the pool is used, so it stays stable per camp.
 */
export function campInterestImageUrl(
  campId: string,
  interests?: RawInterest[],
): string | null {
  const raws = (interests || []).map((i) =>
    typeof i === 'string' ? i : i?.tag ?? i?.interest_name,
  );
  const categories = toCategories(raws);
  if (categories.length === 0) return null;

  const pool =
    categories.length > 1
      ? MULTI_PHOTOS
      : PHOTOS_BY_CATEGORY[categories[0]] ?? MULTI_PHOTOS;

  const photo = pool[hash(campId) % pool.length];
  return `https://images.unsplash.com/${photo}?${UNSPLASH_PARAMS}`;
}
