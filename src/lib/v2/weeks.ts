import type { Camp, CampSession } from '@/types/camp';

export interface WeekOption {
  /** Monday of the week, as YYYY-MM-DD. Stable id used in state + localStorage. */
  key: string;
  start: Date;
  end: Date;
  label: string;
  monthLabel: string;
  isPast: boolean;
  /** Camps with a session overlapping this week. */
  campCount: number;
}

const MS_PER_DAY = 86_400_000;

/** Parses YYYY-MM-DD as a local date. `new Date('2026-06-15')` is UTC and shifts a day west of Greenwich. */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Monday-start week containing `date`. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (result.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  result.setDate(result.getDate() - weekday);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });

  return startMonth === endMonth
    ? `${startMonth} ${start.getDate()}–${end.getDate()}`
    : `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
}

/**
 * Upcoming Monday-start weeks, from the week containing `today` through the week
 * containing `windowEnd`. Past weeks are omitted entirely rather than struck through:
 * the dataset carries a full prior season, so showing them would bury the bookable
 * weeks under a year of dead chips.
 *
 * `campCount` is how many camps have a session overlapping that week, so the picker
 * can show — and dim — weeks with nothing in them.
 */
export function buildWeekOptions(
  camps: Camp[],
  today: Date = new Date(),
  windowEnd: Date = new Date(today.getFullYear(), 7, 14) // Aug 14
): WeekOption[] {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const first = startOfWeek(todayStart);
  const last = startOfWeek(windowEnd);

  if (last.getTime() < first.getTime()) return [];

  const options: WeekOption[] = [];
  let cursor = first;

  // Guard against a malformed bound producing an unbounded loop.
  while (cursor.getTime() <= last.getTime() && options.length < 60) {
    const end = addDays(cursor, 6);

    options.push({
      key: toKey(cursor),
      start: cursor,
      end,
      label: formatRange(cursor, end),
      monthLabel: cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      isPast: end.getTime() < todayStart.getTime(),
      campCount: camps.filter((camp) => sessionOverlapsWeek(camp, cursor, end)).length,
    });

    cursor = addDays(cursor, 7);
  }

  return options;
}

function sessionOverlapsWeek(camp: Camp, weekStart: Date, weekEnd: Date): boolean {
  return (camp.camp_sessions || []).some((session) => {
    const start = session.start_date ? parseLocalDate(session.start_date) : null;
    const end = session.end_date ? parseLocalDate(session.end_date) : null;
    if (!start || !end) return false;
    return start.getTime() <= weekEnd.getTime() + MS_PER_DAY - 1 && end.getTime() >= weekStart.getTime();
  });
}

export function groupWeeksByMonth(weeks: WeekOption[]): Array<{ month: string; weeks: WeekOption[] }> {
  const groups: Array<{ month: string; weeks: WeekOption[] }> = [];

  for (const week of weeks) {
    const last = groups[groups.length - 1];
    if (last && last.month === week.monthLabel) {
      last.weeks.push(week);
    } else {
      groups.push({ month: week.monthLabel, weeks: [week] });
    }
  }

  return groups;
}

/** True when any session overlaps any selected week. */
export function campMatchesWeeks(camp: Camp, selected: WeekOption[]): boolean {
  if (selected.length === 0) return true;

  const sessions = camp.camp_sessions || [];

  return sessions.some((session) => {
    const start = session.start_date ? parseLocalDate(session.start_date) : null;
    const end = session.end_date ? parseLocalDate(session.end_date) : null;
    if (!start || !end) return false;

    return selected.some(
      (week) => start.getTime() <= week.end.getTime() + MS_PER_DAY - 1 && end.getTime() >= week.start.getTime()
    );
  });
}

const coversAge = (session: CampSession, age: number) =>
  (session.min_age ?? 0) <= age && (session.max_age ?? 18) >= age;

/**
 * Age matching.
 *
 * Default is OR: a camp matches if any selected age fits. Adding a second kid therefore
 * widens the result set — correct, but counter-intuitive, which is why `matchAll` exists.
 *
 * With `matchAll`, every selected age must be served, though not necessarily by the same
 * session — a camp with a 5-8 session and a 9-12 session does fit both a 6- and a 10-year-old.
 */
export function campMatchesAges(camp: Camp, ages: number[], matchAll = false): boolean {
  if (ages.length === 0) return true;

  const sessions = camp.camp_sessions || [];

  return matchAll
    ? ages.every((age) => sessions.some((session) => coversAge(session, age)))
    : sessions.some((session) => ages.some((age) => coversAge(session, age)));
}
