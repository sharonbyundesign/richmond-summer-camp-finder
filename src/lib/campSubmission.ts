/**
 * The camp update form's rules, shared by the page (instant feedback) and
 * /api/camps/[id]/updates (the check that counts). Messages here are written
 * for a camp director, not a reviewer: they say what to fix, in plain words.
 *
 * The reviewer-facing rules stay in src/lib/validation/campData.ts; the API
 * runs those too and stores the result on each proposal, so a warning there
 * (an unusual price, a week outside summer) reaches the reviewer rather than
 * blocking the camp.
 */
import { ABSOLUTE_AGE_MAX, ABSOLUTE_PRICE_MAX, MAX_SESSION_DAYS } from '@/lib/validation/campData';

export const MAX_SESSIONS = 60;
export const CONTACT_ROLES = ['Owner or director', 'Staff', 'Other'] as const;

/** One session row exactly as the form holds it: every field a string. */
export interface SessionDraft {
  name: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  min_age: string;
  max_age: string;
  price: string;
  location_id: string;
}

export const EMPTY_SESSION: SessionDraft = {
  name: '',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  min_age: '',
  max_age: '',
  price: '',
  location_id: '',
};

export interface ContactDraft {
  name: string;
  email: string;
  role: string;
  message: string;
}

/** What one session becomes in camp_updates.proposed: only the fields given. */
export type ProposedSession = {
  name?: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  min_age?: number;
  max_age?: number;
  price?: number;
  location_id?: string;
};

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const days = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function wholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  return Number(value.trim());
}

export function checkContact(contact: ContactDraft): FieldErrors<keyof ContactDraft> {
  const errors: FieldErrors<keyof ContactDraft> = {};
  if (!contact.name.trim()) errors.name = 'Add your name.';
  else if (contact.name.trim().length > 120) errors.name = 'Keep your name under 120 characters.';
  if (!EMAIL_RE.test(contact.email.trim())) errors.email = 'Add an email we can reach you at.';
  else if (contact.email.trim().length > 254) errors.email = 'That email is too long.';
  if (contact.role && !(CONTACT_ROLES as readonly string[]).includes(contact.role)) errors.role = 'Pick one.';
  if (contact.message.length > 2000) errors.message = 'Keep this under 2,000 characters.';
  return errors;
}

/**
 * Checks one row and, if it is usable, turns it into the proposal. `seasonYear`
 * is the summer the form collects; a date in another year is an error here
 * (a typo the camp can fix in a second), not a warning for the reviewer.
 */
export function checkSession(
  row: SessionDraft,
  seasonYear: number,
  siteIds: string[],
): { errors: FieldErrors<keyof SessionDraft>; proposed: ProposedSession | null } {
  const errors: FieldErrors<keyof SessionDraft> = {};
  const start = row.start_date.trim();
  const end = row.end_date.trim();

  if (!DATE_RE.test(start)) errors.start_date = 'Add a start date.';
  if (!DATE_RE.test(end)) errors.end_date = 'Add an end date.';
  if (!errors.start_date && !start.startsWith(`${seasonYear}-`)) errors.start_date = `Use a date in ${seasonYear}.`;
  if (!errors.end_date && !end.startsWith(`${seasonYear}-`)) errors.end_date = `Use a date in ${seasonYear}.`;
  if (!errors.start_date && !errors.end_date) {
    if (end < start) errors.end_date = 'The end date is before the start date.';
    else if (days(start, end) > MAX_SESSION_DAYS) errors.end_date = 'This runs longer than a summer — check the end date.';
  }

  const startTime = row.start_time.trim();
  const endTime = row.end_time.trim();
  if (startTime && !TIME_RE.test(startTime)) errors.start_time = 'Use a time like 9:00 AM.';
  if (endTime && !TIME_RE.test(endTime)) errors.end_time = 'Use a time like 3:00 PM.';
  if (!errors.start_time && !errors.end_time && startTime && endTime && endTime <= startTime) {
    errors.end_time = 'The end time is before the start time.';
  }

  const minAge = row.min_age.trim() ? wholeNumber(row.min_age) : null;
  const maxAge = row.max_age.trim() ? wholeNumber(row.max_age) : null;
  if (row.min_age.trim() && (minAge === null || minAge > ABSOLUTE_AGE_MAX)) errors.min_age = 'Use a whole number.';
  if (row.max_age.trim() && (maxAge === null || maxAge > ABSOLUTE_AGE_MAX)) errors.max_age = 'Use a whole number.';
  if (!errors.min_age && !errors.max_age && minAge !== null && maxAge !== null && minAge > maxAge) {
    errors.max_age = 'The oldest age is below the youngest.';
  }

  const priceText = row.price.trim().replace(/[$,\s]/g, '');
  const price = priceText ? Number(priceText) : null;
  if (priceText && (price === null || !Number.isFinite(price) || price < 0 || price > ABSOLUTE_PRICE_MAX)) {
    errors.price = 'Enter the price as a number, like 350.';
  }

  if (row.location_id && !siteIds.includes(row.location_id)) errors.location_id = 'Pick one of your locations.';
  if (row.name.trim().length > 120) errors.name = 'Keep the name under 120 characters.';

  if (Object.keys(errors).length) return { errors, proposed: null };

  const proposed: ProposedSession = { start_date: start, end_date: end };
  if (row.name.trim()) proposed.name = row.name.trim();
  if (startTime) proposed.start_time = startTime;
  if (endTime) proposed.end_time = endTime;
  if (minAge !== null) proposed.min_age = minAge;
  if (maxAge !== null) proposed.max_age = maxAge;
  if (price !== null) proposed.price = Math.round(price * 100) / 100;
  // One site: every session runs there. Several: the camp says which.
  if (row.location_id) proposed.location_id = row.location_id;
  else if (siteIds.length === 1) proposed.location_id = siteIds[0];
  return { errors, proposed };
}

/** A blank row the camp added and never filled in — skipped, not an error. */
export function isBlank(row: SessionDraft): boolean {
  return Object.entries(row).every(([key, value]) => key === 'location_id' || !value.trim());
}
