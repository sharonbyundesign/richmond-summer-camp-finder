// Canonical interest taxonomy.
//
// As of the July 2026 consolidation the Supabase `camp_interests` table is a
// fixed set of top-level categories (see consolidate-camp-interests.sql). The
// original Faith category was later removed by product decision.
// This module is the single source of truth for those categories in the app:
// their display order, an icon for each, and a mapping from every legacy raw
// tag value onto its category.
//
// The map lets the UI and the /api/camps filter behave correctly even before
// the DB migration has been applied — selecting "STEM" still matches a camp
// that is only tagged "Drones" or "LEGO". Once the migration runs the raw
// values ARE the category names, which map to themselves, so this stays valid.

export interface InterestCategory {
  /** Canonical category name, exactly as stored after consolidation. */
  name: string;
  /** Emoji shown next to the category in filters and on cards. */
  icon: string;
}

// Fixed display order for the filter UI.
export const INTEREST_CATEGORIES: InterestCategory[] = [
  { name: 'STEM', icon: '🔬' },
  { name: 'Arts', icon: '🎨' },
  { name: 'Performing Arts', icon: '🎭' },
  { name: 'Sports', icon: '⚽' },
  { name: 'Outdoors & Nature', icon: '🌲' },
  { name: 'Academics', icon: '📚' },
  { name: 'Culinary', icon: '🍳' },
  { name: 'Culture', icon: '🌍' },
];

export const CATEGORY_NAMES: string[] = INTEREST_CATEGORIES.map((c) => c.name);

const ICON_BY_NAME = new Map(INTEREST_CATEGORIES.map((c) => [c.name, c.icon]));

/** Icon for a canonical category name (empty string if unknown). */
export function categoryIcon(name: string): string {
  return ICON_BY_NAME.get(name) ?? '';
}

// Every legacy raw tag value (lowercased) -> canonical category. Ported from
// consolidate-camp-interests.sql so the client and API agree with the DB.
const RAW_TO_CATEGORY: Record<string, string> = {
  // STEM
  stem: 'STEM', science: 'STEM', technology: 'STEM', engineering: 'STEM',
  math: 'STEM', robotics: 'STEM', coding: 'STEM', experiments: 'STEM',
  exploration: 'STEM', cybersecurity: 'STEM', drones: 'STEM', lego: 'STEM',
  building: 'STEM', design: 'STEM', architecture: 'STEM',
  'video game design': 'STEM', 'video production': 'STEM',
  'stop motion animation': 'STEM', biology: 'STEM',
  // Arts
  art: 'Arts', arts: 'Arts', 'arts and crafts': 'Arts', crafts: 'Arts',
  painting: 'Arts', drawing: 'Arts', sculpture: 'Arts', creativity: 'Arts',
  creative: 'Arts', 'creative play': 'Arts', dolls: 'Arts',
  // Performing Arts
  'performing arts': 'Performing Arts', 'performing-arts': 'Performing Arts',
  theater: 'Performing Arts', theatre: 'Performing Arts', drama: 'Performing Arts',
  dance: 'Performing Arts', music: 'Performing Arts', comedy: 'Performing Arts',
  improv: 'Performing Arts', performance: 'Performing Arts',
  'music production': 'Performing Arts',
  // Sports
  sports: 'Sports', swim: 'Sports', swimming: 'Sports', 'martial arts': 'Sports',
  fitness: 'Sports', gymnastics: 'Sports', 'water sports': 'Sports',
  water_sports: 'Sports', 'water activities': 'Sports', 'water safety': 'Sports',
  'team building': 'Sports', team_building: 'Sports', games: 'Sports',
  // Outdoors & Nature
  outdoors: 'Outdoors & Nature', outdoor: 'Outdoors & Nature',
  'outdoor adventures': 'Outdoors & Nature', nature: 'Outdoors & Nature',
  adventure: 'Outdoors & Nature', fishing: 'Outdoors & Nature',
  biking: 'Outdoors & Nature', animals: 'Outdoors & Nature',
  wildlife: 'Outdoors & Nature', gardening: 'Outdoors & Nature',
  farming: 'Outdoors & Nature', 'environmental education': 'Outdoors & Nature',
  'field trips': 'Outdoors & Nature', 'field-trips': 'Outdoors & Nature',
  // Academics
  academic: 'Academics', academics: 'Academics', debate: 'Academics',
  'public speaking': 'Academics', law: 'Academics', 'mock trial': 'Academics',
  leadership: 'Academics', 'critical thinking': 'Academics', enrichment: 'Academics',
  'character development': 'Academics', 'executive functioning': 'Academics',
  'brain development': 'Academics',
  // Culinary
  cooking: 'Culinary', 'culinary arts': 'Culinary', nutrition: 'Culinary',
  'life skills': 'Culinary',
  // Culture
  culture: 'Culture', cultural: 'Culture', 'world cultures': 'Culture',
  museum: 'Culture', disney: 'Culture',
};

// Canonical names map to themselves (covers post-migration raw values such as
// "Outdoors & Nature" and "Culinary" that aren't legacy keys above).
for (const name of CATEGORY_NAMES) {
  RAW_TO_CATEGORY[name.toLowerCase()] = name;
}

/**
 * Normalize any raw interest tag onto its canonical category.
 * Returns null for empty/unknown values so callers can drop them.
 */
export function normalizeInterest(raw?: string | null): string | null {
  if (!raw) return null;
  return RAW_TO_CATEGORY[raw.trim().toLowerCase()] ?? null;
}

/**
 * Collapse a list of raw tags to the unique canonical categories they belong
 * to, returned in the fixed display order.
 */
export function toCategories(raws: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const raw of raws) {
    const cat = normalizeInterest(raw);
    if (cat) found.add(cat);
  }
  return CATEGORY_NAMES.filter((name) => found.has(name));
}
