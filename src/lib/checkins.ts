/**
 * Parent check-ins: the rules shared by the form, the API and the camp page.
 *
 * A check-in is "Did your child go here? Would you send them again?", a few set
 * tags and an optional short comment. Set answers carry little legal risk and
 * need no moderation; the comment is free text, so it waits for a reviewer.
 * See supabase/migrations/009_camp_checkins.up.sql and /terms.
 */
import { ACTIVE_SEASON_YEAR } from '@/lib/trust';

/** A camp shows its parents' summary only once this many have confirmed. */
export const SUMMARY_MIN = 5;
export const COMMENT_MAX = 280;
export const TAGS_MAX = 6;

/**
 * Set tags, praise and criticism both, so the list doesn't steer parents
 * toward a positive answer. Ids are stored; labels can change.
 */
export const CHECKIN_TAGS = [
  { id: 'great_counselors', label: 'Great counselors', tone: 'good' },
  { id: 'made_friends', label: 'Made friends', tone: 'good' },
  { id: 'good_for_shy_kids', label: 'Good for shy kids', tone: 'good' },
  { id: 'well_organized', label: 'Well organized', tone: 'good' },
  { id: 'worth_the_price', label: 'Worth the price', tone: 'good' },
  { id: 'came_home_tired_happy', label: 'Came home tired and happy', tone: 'good' },
  { id: 'felt_disorganized', label: 'Felt disorganized', tone: 'critical' },
  { id: 'pricey', label: 'Pricey for what it was', tone: 'critical' },
  { id: 'communication', label: 'Communication could be better', tone: 'critical' },
] as const;

export type CheckinTagId = (typeof CHECKIN_TAGS)[number]['id'];
const TAG_IDS = new Set<string>(CHECKIN_TAGS.map((t) => t.id));
export const tagLabel = (id: string) => CHECKIN_TAGS.find((t) => t.id === id)?.label ?? id;

/** The summers a parent can report on: last season and the three before it. */
export function attendedYearOptions(): number[] {
  const last = ACTIVE_SEASON_YEAR - 1;
  return [last, last - 1, last - 2, last - 3];
}

export interface CheckinDraft {
  email: string;
  attended_year: string;
  would_return: '' | 'yes' | 'no';
  tags: string[];
  comment: string;
}

export type CheckinErrors = Partial<Record<keyof CheckinDraft, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkCheckin(draft: CheckinDraft): {
  errors: CheckinErrors;
  clean: { email: string; attended_year: number; would_return: boolean; tags: string[]; comment: string | null } | null;
} {
  const errors: CheckinErrors = {};
  const email = draft.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Add an email we can send a confirm link to.';
  const year = Number(draft.attended_year);
  if (!attendedYearOptions().includes(year)) errors.attended_year = 'Pick the summer your child went.';
  if (draft.would_return !== 'yes' && draft.would_return !== 'no') errors.would_return = 'Pick yes or no.';
  const tags = Array.from(new Set(draft.tags)).filter((t) => TAG_IDS.has(t));
  if (tags.length > TAGS_MAX) errors.tags = `Pick up to ${TAGS_MAX}.`;
  const comment = draft.comment.trim();
  if (comment.length > COMMENT_MAX) errors.comment = `Keep it under ${COMMENT_MAX} characters.`;

  if (Object.keys(errors).length) return { errors, clean: null };
  return {
    errors,
    clean: { email, attended_year: year, would_return: draft.would_return === 'yes', tags, comment: comment || null },
  };
}

/** What a camp page shows: computed server-side from confirmed check-ins only. */
export interface CheckinSummary {
  /** Confirmed check-ins. Below SUMMARY_MIN the page shows only the invite. */
  count: number;
  wouldReturn: number | null;
  tags: Array<{ id: string; label: string; count: number }>;
  comments: Array<{ text: string; would_return: boolean; attended_year: number }>;
}
