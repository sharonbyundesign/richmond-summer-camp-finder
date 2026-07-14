import type { CampSession } from '@/types/camp';

/**
 * Address strings are inconsistent — some have commas, some don't, some carry embedded
 * newlines or stray invisible characters ("3411 Cox Road\n​Henrico, VA 23233").
 * Positional parsing breaks on roughly half of them, so match known city names instead.
 * Longest first, so "Colonial Heights" wins over "Chester" and "Glen Allen" over "Allen".
 */
const CITIES = [
  'Colonial Heights',
  'Manakin-Sabot',
  'Mechanicsville',
  'Charles City',
  'Midlothian',
  'Chesterfield',
  'Glen Allen',
  'Short Pump',
  'Petersburg',
  'Goochland',
  'New Kent',
  'Rockville',
  'Powhatan',
  'Richmond',
  'Sandston',
  'Ashland',
  'Hanover',
  'Moseley',
  'Quinton',
  'Bon Air',
  'Crozier',
  'Maidens',
  'Chester',
  'Henrico',
  'Varina',
];

export function cityFromLocation(location?: string | null): string | null {
  if (!location) return null;
  const haystack = location.replace(/\s+/g, ' ');
  return CITIES.find((city) => new RegExp(`\\b${city}\\b`, 'i').test(haystack)) ?? null;
}

export function ageRange(sessions?: CampSession[]): string | null {
  const mins = (sessions || []).map((s) => s.min_age).filter((n): n is number => n != null);
  const maxes = (sessions || []).map((s) => s.max_age).filter((n): n is number => n != null);
  if (mins.length === 0 && maxes.length === 0) return null;

  const min = mins.length ? Math.min(...mins) : null;
  const max = maxes.length ? Math.max(...maxes) : null;
  if (min != null && max != null) return `Ages ${min}–${max}`;
  return min != null ? `Ages ${min}+` : `Ages up to ${max}`;
}

/** "May 31 – Aug 20", with years only when the range crosses one. */
export function sessionRange(sessions?: CampSession[]): string | null {
  const starts = (sessions || [])
    .map((s) => (s.start_date ? new Date(s.start_date).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  const ends = (sessions || [])
    .map((s) => (s.end_date ? new Date(s.end_date).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));

  if (starts.length === 0 || ends.length === 0) return null;

  const first = new Date(Math.min(...starts));
  const last = new Date(Math.max(...ends));
  const sameYear = first.getFullYear() === last.getFullYear();

  const fmt = (date: Date, withYear: boolean) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    });

  return `${fmt(first, !sameYear)} – ${fmt(last, !sameYear)}`;
}
