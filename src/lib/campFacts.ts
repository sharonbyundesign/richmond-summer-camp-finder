import type { CampSession } from '@/types/camp';
import { ageRange, sessionRange } from '@/lib/campCardFormat';
import { classifySessionType, weekdaysBetween, weekStartOf, weeklyPrice } from '@/lib/campFilters';

export interface CampFacts {
  ages: string | null;
  price: string | null;
  day: string | null;
  weeks: string | null;
  /** "Jun 8 – Aug 7", under the weeks count. */
  weeksRange: string | null;
}

function nextWeek(mondayISO: string): string {
  const d = new Date(`${mondayISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

const DAY_LABEL ={ full: 'Full day', am: 'Half day (AM)', pm: 'Half day (PM)', overnight: 'Overnight' };

/**
 * The four things parents scan a camp for — ages, price, day length, weeks —
 * summarized over one season, so last summer's weeks never add to this one's.
 * Returns null when the camp has no sessions; any single fact is null when no
 * session states it.
 */
export function campFacts(sessions: CampSession[] = []): CampFacts | null {
  const dated = sessions.filter((s) => s.start_date);
  if (dated.length === 0) return null;

  const latestYear = dated.reduce((y, s) => (s.start_date.slice(0, 4) > y ? s.start_date.slice(0, 4) : y), '');
  const season = dated.filter((s) => s.start_date.startsWith(latestYear));

  // Price per week, which is what the Price filter compares. Sessions shorter
  // than four weekdays keep their own price, so "/ week" would overstate them.
  const priced = season.filter((s) => s.price != null);
  const weekly = priced.map((s) => weeklyPrice(s)!);
  const allWeekLong = priced.every((s) => (weekdaysBetween(s.start_date, s.end_date) ?? 0) >= 4);
  const money = (n: number) => (n === 0 ? 'Free' : `$${Math.round(n).toLocaleString('en-US')}`);
  let price: string | null = null;
  if (weekly.length) {
    const lo = Math.min(...weekly);
    const hi = Math.max(...weekly);
    price = hi === 0 ? 'Free' : `${lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`}${allWeekLong ? ' / week' : ''}`;
  }

  const types = new Set(season.map(classifySessionType).filter((t) => t !== 'unknown'));
  const half = types.has('am') || types.has('pm');
  let day: string | null = null;
  if (types.size === 1) day = DAY_LABEL[Array.from(types)[0]];
  else if (types.has('full') && half) day = 'Full & half day';
  else if (half && !types.has('full')) day = 'Half day';
  else if (types.size > 1) day = 'Varies';

  // Weeks the camp runs in, so a two-week intensive counts as two.
  const weeksRun = new Set<string>();
  for (const s of season) {
    const last = weekStartOf(s.end_date || s.start_date) ?? '';
    for (let wk = weekStartOf(s.start_date); wk && wk <= last; wk = nextWeek(wk)) weeksRun.add(wk);
  }
  const weekCount = weeksRun.size;

  return {
    ages: ageRange(season),
    price,
    day,
    weeks: `${weekCount} ${weekCount === 1 ? 'week' : 'weeks'}`,
    weeksRange: sessionRange(season),
  };
}
