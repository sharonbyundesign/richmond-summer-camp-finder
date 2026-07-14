// Card/thumbnail illustrations, keyed off a camp's interests.
//
// Sharon uploaded one illustration per canonical interest category (plus a
// "Multi" catch-all) to the public Supabase Storage bucket `camp_illustration`.
// A camp's card, map popup and detail hero all show the illustration for its
// interest: the single category when it has exactly one, and Multi when it
// spans two or more. This replaces the previously scraped/curated photos.

import { toCategories } from './interest-categories';

const BUCKET = 'camp_illustration';

// Canonical category name (from interest-categories) -> asset filename in the
// bucket. Filenames match what's stored exactly, including the space and casing
// of "Performing arts.jpg" and the shorter "Outdoor.jpg".
const FILE_BY_CATEGORY: Record<string, string> = {
  STEM: 'STEM.jpg',
  Arts: 'Arts.jpg',
  'Performing Arts': 'Performing arts.jpg',
  Sports: 'Sports.jpg',
  'Outdoors & Nature': 'Outdoor.jpg',
  Academics: 'Academics.jpg',
  Culinary: 'Culinary.jpg',
  Culture: 'Culture.jpg',
};

const MULTI_FILE = 'Multi.jpg';

type RawInterest = { tag?: string; interest_name?: string } | string | null | undefined;

function fileUrl(file: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  // encodeURIComponent handles the space in "Performing arts.jpg".
  return `${base}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(file)}`;
}

/**
 * Public URL of the illustration for a camp's interests, or null when the camp
 * has no recognised interest (callers fall back to their placeholder).
 */
export function campIllustrationUrl(interests?: RawInterest[]): string | null {
  const raws = (interests || []).map((i) =>
    typeof i === 'string' ? i : i?.tag ?? i?.interest_name,
  );
  const categories = toCategories(raws);

  if (categories.length === 0) return null;
  if (categories.length > 1) return fileUrl(MULTI_FILE);
  return fileUrl(FILE_BY_CATEGORY[categories[0]] ?? MULTI_FILE);
}
