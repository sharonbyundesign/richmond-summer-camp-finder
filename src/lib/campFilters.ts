// Shared filtering logic for the camp finder.
//
// Everything here is pure and dependency-free so it can run identically on the
// server (the /api/camps route) and in the browser (live count in the filter
// panel). Filters combine with AND across sections and OR within a section's
// multi-select chips. Each session-level section is an existential over a
// camp's sessions ("camp matches if it has at least one session that fits").

import { normalizeInterest, toCategories } from '@/lib/interest-categories';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionType = 'full' | 'am' | 'pm' | 'overnight';
export type PriceBracket = 'under200' | '200-350' | '350-500' | '500plus';

export interface SessionLike {
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  min_age?: number | null;
  max_age?: number | null;
  price?: number | null;
}

export interface CampLike {
  latitude?: number | null;
  longitude?: number | null;
  camp_sessions?: SessionLike[] | null;
  camp_interests?: Array<{ tag?: string | null; interest_name?: string | null }> | null;
}

export interface Filters {
  interests: string[];
  ages: number[];
  matchAllAges: boolean;
  weeks: string[]; // Monday ISO dates, e.g. "2026-06-15"
  sessionTypes: SessionType[];
  priceBrackets: PriceBracket[];
  zip: string;
  radius: number; // miles; only applied when zip resolves to a centroid
}

export interface LatLng {
  lat: number;
  lng: number;
}

export const DEFAULT_RADIUS = 10;

export const SESSION_TYPE_OPTIONS: Array<{ value: SessionType; label: string }> = [
  { value: 'full', label: 'Full day' },
  { value: 'am', label: 'Half day AM' },
  { value: 'pm', label: 'Half day PM' },
  { value: 'overnight', label: 'Overnight' },
];

export const PRICE_BRACKET_OPTIONS: Array<{ value: PriceBracket; label: string }> = [
  { value: 'under200', label: 'Under $200' },
  { value: '200-350', label: '$200–350' },
  { value: '350-500', label: '$350–500' },
  { value: '500plus', label: '$500+' },
];

export const RADIUS_OPTIONS = [5, 10, 20];

export function emptyFilters(): Filters {
  return {
    interests: [],
    ages: [],
    matchAllAges: false,
    weeks: [],
    sessionTypes: [],
    priceBrackets: [],
    zip: '',
    radius: DEFAULT_RADIUS,
  };
}

// ---------------------------------------------------------------------------
// Classification helpers (tune thresholds here)
// ---------------------------------------------------------------------------

function parseMinutes(time: string): number | null {
  const parts = time.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? '0');
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Classify a session into a coarse session type from its start/end time.
// There is no dedicated "overnight" column in the data, so overnight is
// inferred from duration (a session that spans >= 12h or crosses midnight).
// Thresholds are intentionally centralized so they can be retuned in one place.
export function classifySessionType(session: SessionLike): SessionType | 'unknown' {
  const { start_time, end_time } = session;
  if (!start_time || !end_time) return 'unknown';

  const start = parseMinutes(start_time);
  const end = parseMinutes(end_time);
  if (start === null || end === null) return 'unknown';

  let duration = end - start;
  if (duration <= 0) duration += 24 * 60; // crosses midnight

  if (duration >= 12 * 60) return 'overnight';
  if (duration >= 5 * 60) return 'full';
  return start < 12 * 60 ? 'am' : 'pm';
}

export function priceBracketOf(price: number | null | undefined): PriceBracket | null {
  if (price === null || price === undefined) return null;
  if (price < 200) return 'under200';
  if (price < 350) return '200-350';
  if (price < 500) return '350-500';
  return '500plus';
}

// ---------------------------------------------------------------------------
// Week helpers (timezone-safe via UTC arithmetic on YYYY-MM-DD strings)
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseISODate(dateStr: string): Date | null {
  const m = dateStr.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Monday (ISO week start) of the week containing the given date.
export function weekStartOf(dateStr: string): string | null {
  const d = parseISODate(dateStr);
  if (!d) return null;
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  return toISO(d);
}

// Label a Monday-week as "Jun 15–19" (Mon–Fri), spanning months if needed.
export function weekLabel(mondayISO: string): string {
  const mon = parseISODate(mondayISO);
  if (!mon) return mondayISO;
  const fri = new Date(mon);
  fri.setUTCDate(fri.getUTCDate() + 4);
  const m1 = MONTHS[mon.getUTCMonth()];
  const m2 = MONTHS[fri.getUTCMonth()];
  const d1 = mon.getUTCDate();
  const d2 = fri.getUTCDate();
  return m1 === m2 ? `${m1} ${d1}–${d2}` : `${m1} ${d1}–${m2} ${d2}`;
}

// Full month name of the week's Monday (used to group week chips).
export function weekMonthName(mondayISO: string): string {
  const mon = parseISODate(mondayISO);
  return mon ? MONTH_NAMES[mon.getUTCMonth()] : '';
}

// A week is "past" once its Friday (Mon+4) is before today, so weeks that have
// already ended can be disabled in the picker. Compared against the local date.
export function isWeekPast(mondayISO: string, now: Date = new Date()): boolean {
  const mon = parseISODate(mondayISO);
  if (!mon) return false;
  const fri = new Date(mon);
  fri.setUTCDate(fri.getUTCDate() + 4);
  const fridayISO = toISO(fri);
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return fridayISO < todayISO;
}

// Distinct sorted Monday-weeks derived from the sessions of the given camps.
export function deriveWeeks(camps: CampLike[]): Array<{ weekStart: string; label: string }> {
  const set = new Set<string>();
  for (const camp of camps) {
    for (const session of camp.camp_sessions || []) {
      if (session.start_date) {
        const wk = weekStartOf(session.start_date);
        if (wk) set.add(wk);
      }
    }
  }
  return Array.from(set)
    .sort()
    .map((weekStart) => ({ weekStart, label: weekLabel(weekStart) }));
}

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------------------
// Per-section session predicates
// ---------------------------------------------------------------------------

function sessionCoversAge(session: SessionLike, age: number): boolean {
  const min = session.min_age ?? 0;
  const max = session.max_age ?? 18;
  return min <= age && age <= max;
}

function campMatchesAges(camp: CampLike, ages: number[], matchAll: boolean): boolean {
  const sessions = camp.camp_sessions || [];
  if (matchAll) {
    // Every entered age must be served by at least one (possibly different) session.
    return ages.every((age) => sessions.some((s) => sessionCoversAge(s, age)));
  }
  // Any entered age served by any session.
  return sessions.some((s) => ages.some((age) => sessionCoversAge(s, age)));
}

// ---------------------------------------------------------------------------
// Main filter
// ---------------------------------------------------------------------------

export function filterCamps<T extends CampLike>(
  camps: T[],
  filters: Filters,
  origin: LatLng | null,
): T[] {
  const {
    interests,
    ages,
    matchAllAges,
    weeks,
    sessionTypes,
    priceBrackets,
    radius,
  } = filters;

  const weekSet = new Set(weeks);
  const typeSet = new Set(sessionTypes);
  const priceSet = new Set(priceBrackets);
  const distanceActive = !!origin && radius > 0;

  return camps.filter((camp) => {
    const sessions = camp.camp_sessions || [];

    // Interests (camp-level): camp has at least one selected category.
    if (interests.length > 0) {
      const selected = new Set(interests.map((i) => normalizeInterest(i) ?? i));
      const campCategories = toCategories(
        (camp.camp_interests || []).map((ci) => ci?.tag || ci?.interest_name),
      );
      if (!campCategories.some((cat) => selected.has(cat))) return false;
    }

    // Ages (session-level).
    if (ages.length > 0 && !campMatchesAges(camp, ages, matchAllAges)) {
      return false;
    }

    // Weeks: at least one session starting in a selected week.
    if (weekSet.size > 0) {
      const ok = sessions.some((s) => {
        if (!s.start_date) return false;
        const wk = weekStartOf(s.start_date);
        return wk !== null && weekSet.has(wk);
      });
      if (!ok) return false;
    }

    // Session type: at least one session classified into a selected type.
    if (typeSet.size > 0) {
      const ok = sessions.some((s) => {
        const type = classifySessionType(s);
        return type !== 'unknown' && typeSet.has(type);
      });
      if (!ok) return false;
    }

    // Price bracket: at least one session in a selected bracket. Null-price
    // sessions never match an active price filter.
    if (priceSet.size > 0) {
      const ok = sessions.some((s) => {
        const bracket = priceBracketOf(s.price);
        return bracket !== null && priceSet.has(bracket);
      });
      if (!ok) return false;
    }

    // Distance (camp-level): camp must have coordinates within the radius.
    if (distanceActive) {
      if (camp.latitude === null || camp.latitude === undefined) return false;
      if (camp.longitude === null || camp.longitude === undefined) return false;
      const miles = haversineMiles(origin!, { lat: camp.latitude, lng: camp.longitude });
      if (miles > radius) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// URL <-> Filters round-trip (shared by client and server)
// ---------------------------------------------------------------------------

// Accepts anything with getAll/get (URLSearchParams or Next's ReadonlyURLSearchParams).
interface ParamsLike {
  getAll(name: string): string[];
  get(name: string): string | null;
}

export function parseFiltersFromParams(params: ParamsLike): Filters {
  const ages = params
    .getAll('age')
    .map((a) => parseInt(a, 10))
    .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 18);

  const sessionTypes = params
    .getAll('type')
    .filter((t): t is SessionType =>
      SESSION_TYPE_OPTIONS.some((o) => o.value === t),
    );

  const priceBrackets = params
    .getAll('price')
    .filter((p): p is PriceBracket =>
      PRICE_BRACKET_OPTIONS.some((o) => o.value === p),
    );

  const radiusRaw = parseInt(params.get('radius') || '', 10);
  const radius = RADIUS_OPTIONS.includes(radiusRaw) ? radiusRaw : DEFAULT_RADIUS;

  return {
    interests: params.getAll('interest'),
    ages,
    matchAllAges: params.get('matchAllAges') === '1',
    weeks: params.getAll('week'),
    sessionTypes,
    priceBrackets,
    zip: (params.get('zip') || '').trim(),
    radius,
  };
}

export function filtersToSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  filters.interests.forEach((i) => params.append('interest', i));
  filters.ages.forEach((a) => params.append('age', String(a)));
  if (filters.matchAllAges && filters.ages.length > 0) params.set('matchAllAges', '1');
  filters.weeks.forEach((w) => params.append('week', w));
  filters.sessionTypes.forEach((t) => params.append('type', t));
  filters.priceBrackets.forEach((p) => params.append('price', p));
  if (filters.zip) {
    params.set('zip', filters.zip);
    if (filters.radius !== DEFAULT_RADIUS) params.set('radius', String(filters.radius));
  }
  return params;
}

export function countActiveFilters(filters: Filters): number {
  return (
    filters.interests.length +
    filters.ages.length +
    filters.weeks.length +
    filters.sessionTypes.length +
    filters.priceBrackets.length +
    (filters.zip ? 1 : 0)
  );
}

export function filtersEqual(a: Filters, b: Filters): boolean {
  return filtersToSearchParams(a).toString() === filtersToSearchParams(b).toString();
}
