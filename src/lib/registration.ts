/**
 * Registration windows: what a parent needs to plan around a camp that fills
 * fast — when registration opens, and a calendar reminder for that moment.
 * Data from camp_registrations (migration 010); dates are Richmond local time.
 */
import type { Camp, CampRegistration } from '@/types/camp';
import { ACTIVE_SEASON_YEAR } from '@/lib/trust';

const TZ = 'America/New_York';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The row for the summer the site is about, if any. */
export function currentRegistration(camp: Pick<Camp, 'camp_registrations'>): CampRegistration | null {
  return camp.camp_registrations?.find((r) => r.season_year === ACTIVE_SEASON_YEAR) ?? null;
}

/** Today in Richmond, as YYYY-MM-DD. */
export function todayInRichmond(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
}

/** "Jan 15", "Fri, Jan 15". Parsed as UTC so the date never shifts. */
export function shortDate(iso: string, withDay = false): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withDay ? `${DAYS[d.getUTCDay()]}, ${base}` : base;
}

/** "7:00 AM" from "07:00:00". */
export function shortTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export type RegistrationState = 'open' | 'opens' | 'waitlist' | 'full' | 'note';

/**
 * The one line a card shows, or null when there's nothing to say.
 * "Registration open" · "Registration opens Jan 15" · "Waitlist only" · "Full"
 * · or the camp's own words ("Opens mid to late February").
 */
export function registrationPill(
  reg: CampRegistration | null,
  today: string = todayInRichmond(),
): { state: RegistrationState; text: string } | null {
  if (!reg) return null;
  if (reg.status === 'full') return { state: 'full', text: 'Full' };
  if (reg.status === 'waitlist') return { state: 'waitlist', text: 'Waitlist only' };
  if (reg.status === 'open' || (reg.opens_on && reg.opens_on <= today)) {
    return { state: 'open', text: 'Registration open' };
  }
  // The earliest upcoming window, so a member date isn't missed.
  const next = [reg.priority_opens_on, reg.opens_on].filter((d): d is string => Boolean(d) && d! > today).sort()[0];
  if (next) return { state: 'opens', text: `Registration opens ${shortDate(next)}` };
  if (reg.opens_note) return { state: 'note', text: `Registration: ${reg.opens_note}` };
  return null;
}

/** Whether a camp counts as "registration open" for the filter. */
export function isRegistrationOpen(camp: Pick<Camp, 'camp_registrations'>, today: string = todayInRichmond()): boolean {
  return registrationPill(currentRegistration(camp), today)?.state === 'open';
}

/** The date a camp's registration opens next (for sorting), or null. */
export function nextOpening(camp: Pick<Camp, 'camp_registrations'>, today: string = todayInRichmond()): string | null {
  const reg = currentRegistration(camp);
  if (!reg) return null;
  return [reg.priority_opens_on, reg.opens_on].filter((d): d is string => Boolean(d) && d! > today).sort()[0] ?? null;
}

// ---------------------------------------------------------------------------
// Calendar reminders
// ---------------------------------------------------------------------------

export interface ReminderEvent {
  uid: string;
  title: string;
  /** YYYY-MM-DD, Richmond local. */
  date: string;
  /** HH:MM[:SS], Richmond local; all-day when absent. */
  time?: string | null;
  url?: string | null;
  description: string;
}

/** The UTC instant for a Richmond wall-clock time (handles EST/EDT). */
function richmondToUtc(date: string, time: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  // What Richmond's clock reads at `guess`; the difference is the offset.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess.getTime() - (shown - guess.getTime()));
}

const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** One .ics file for one or more reminders, each with an alert. */
export function buildIcs(events: ReminderEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Scouty//Registration reminders//EN', 'CALSCALE:GREGORIAN'];
  const now = icsStamp(new Date());
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@scouty`, `DTSTAMP:${now}`, `SUMMARY:${icsText(e.title)}`);
    if (e.time) {
      const start = richmondToUtc(e.date, e.time);
      lines.push(`DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(new Date(start.getTime() + 30 * 60_000))}`);
    } else {
      const day = e.date.replace(/-/g, '');
      const next = new Date(`${e.date}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`);
    }
    lines.push(`DESCRIPTION:${icsText(e.description + (e.url ? `\n${e.url}` : ''))}`);
    if (e.url) lines.push(`URL:${e.url}`);
    // The day before, and (for a timed event) 15 minutes before.
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`, 'TRIGGER:-P1D', 'END:VALARM');
    if (e.time) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`, 'TRIGGER:-PT15M', 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** A Google Calendar "add event" link for one reminder. */
export function googleCalendarUrl(e: ReminderEvent): string {
  let dates: string;
  if (e.time) {
    const start = richmondToUtc(e.date, e.time);
    dates = `${icsStamp(start)}/${icsStamp(new Date(start.getTime() + 30 * 60_000))}`;
  } else {
    const next = new Date(`${e.date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    dates = `${e.date.replace(/-/g, '')}/${next.toISOString().slice(0, 10).replace(/-/g, '')}`;
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates,
    details: e.description + (e.url ? `\n${e.url}` : ''),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** The reminders for one camp: its priority window (if any) and general opening. */
export function remindersFor(camp: Pick<Camp, 'id' | 'name' | 'camp_registrations'>, today: string = todayInRichmond()): ReminderEvent[] {
  const reg = currentRegistration(camp);
  if (!reg) return [];
  const out: ReminderEvent[] = [];
  if (reg.priority_opens_on && reg.priority_opens_on > today) {
    out.push({
      uid: `${camp.id}-${reg.season_year}-priority`,
      title: `${camp.name}: early registration opens`,
      date: reg.priority_opens_on,
      time: reg.priority_opens_time,
      url: reg.registration_url,
      description: `${reg.priority_note ?? 'Early registration'} for ${camp.name}'s ${reg.season_year} camps. Check whether you qualify.`,
    });
  }
  if (reg.opens_on && reg.opens_on > today) {
    out.push({
      uid: `${camp.id}-${reg.season_year}`,
      title: `${camp.name}: registration opens`,
      date: reg.opens_on,
      time: reg.opens_time,
      url: reg.registration_url,
      description: `Registration for ${camp.name}'s ${reg.season_year} camps opens${reg.opens_time ? ` at ${shortTime(reg.opens_time)}` : ''}.${reg.fills_fast ? ' It filled fast last year.' : ''}`,
    });
  }
  return out;
}

/** Hands the browser an .ics file to open in the person's calendar app. */
export function downloadIcs(events: ReminderEvent[], filename: string): void {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
