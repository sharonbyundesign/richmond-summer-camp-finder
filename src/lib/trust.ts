// How camp provenance is turned into something a parent can act on.
//
// The database stores provenance per row (migrations 001); this module is the
// app's single definition of how those rows roll up into one badge and how that
// badge is worded. The `camp_trust` SQL view answers the same question for
// reporting in the SQL editor — if the rule here changes, change the view too.
//
// The rule is "the worst wins". A camp whose July week is confirmed by the camp
// and whose August price is a guess is, to a parent, a camp with a guessed
// price. Averaging confidence would hide exactly the row they are about to rely
// on, so nothing here averages anything.

import type { VerificationStatus } from '@/types/database';

/**
 * The season the site is selling. Everything older is shown as last year's
 * schedule. Bump this one constant when 2027 data is in.
 */
export const ACTIVE_SEASON_YEAR = 2027;

/** Below this, a field is worth warning about rather than presenting as fact. */
export const LOW_CONFIDENCE = 0.6;

const RANK: Record<VerificationStatus, number> = {
  unverified: 0,
  auto: 1,
  human_checked: 2,
  camp_confirmed: 3,
};

/** Mirrors public.verification_rank(text) in migration 001. */
export function verificationRank(status: VerificationStatus): number {
  return RANK[status] ?? 0;
}

export type ConfidenceField = 'dates' | 'price' | 'ages';

interface SessionTrustLike {
  start_date?: string;
  season_year?: number | null;
  source_url?: string | null;
  last_verified_at?: string | null;
  verification_status?: VerificationStatus;
  confidence_dates?: number | null;
  confidence_price?: number | null;
  confidence_ages?: number | null;
}

interface CampTrustLike {
  source_url?: string | null;
  season_year?: number | null;
  last_verified_at?: string | null;
  verification_status?: VerificationStatus;
  website_url?: string;
  camp_sessions?: SessionTrustLike[];
}

export interface TrustSummary {
  /**
   * False before migration 001 runs, when the API has no trust columns to
   * return. Callers render nothing rather than guessing — an absent column and
   * an unverified row are different claims.
   */
  known: boolean;
  /** The newest season we hold a schedule for, not the season we wish we had. */
  seasonYear: number | null;
  /** Worst status across that season's sessions, or the camp's own if it has none. */
  status: VerificationStatus;
  /** Oldest check among the rows behind `status` — the weakest link, again. */
  lastVerifiedAt: string | null;
  sourceUrl: string | null;
  /** The schedule we hold predates the season being sold. */
  isStale: boolean;
  sessionsInSeason: number;
  /** Fields any in-season session reports low confidence in. */
  lowConfidenceFields: ConfidenceField[];
}

function seasonOf(session: SessionTrustLike): number | null {
  if (typeof session.season_year === 'number') return session.season_year;
  const year = Number(session.start_date?.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

/** Fields this session is not confident about. NULL means "never scored", not zero. */
export function lowConfidenceFields(session: SessionTrustLike): ConfidenceField[] {
  const scores: Array<[ConfidenceField, number | null | undefined]> = [
    ['dates', session.confidence_dates],
    ['price', session.confidence_price],
    ['ages', session.confidence_ages],
  ];

  return scores
    .filter(([, score]) => typeof score === 'number' && score < LOW_CONFIDENCE)
    .map(([field]) => field);
}

export function summarizeTrust(camp: CampTrustLike): TrustSummary {
  const sessions = camp.camp_sessions ?? [];

  const known =
    camp.verification_status !== undefined ||
    sessions.some((session) => session.verification_status !== undefined);

  const seasons = sessions.map(seasonOf).filter((year): year is number => year !== null);
  const seasonYear = seasons.length > 0 ? Math.max(...seasons) : camp.season_year ?? null;

  // Only the newest season's sessions speak for the camp. Last year's rows are
  // history; rolling them in would hold a camp's badge down forever.
  const current = sessions.filter((session) => seasonOf(session) === seasonYear);

  const statuses = current
    .map((session) => session.verification_status)
    .filter((status): status is VerificationStatus => status !== undefined);

  const status =
    statuses.length > 0
      ? statuses.reduce((worst, next) => (verificationRank(next) < verificationRank(worst) ? next : worst))
      : camp.verification_status ?? 'unverified';

  const checkedAt = current
    .map((session) => session.last_verified_at)
    .filter((value): value is string => Boolean(value))
    .sort();

  const lastVerifiedAt = checkedAt[0] ?? camp.last_verified_at ?? null;

  const sourceUrl =
    current.find((session) => session.source_url)?.source_url ?? camp.source_url ?? null;

  const lowFields = new Set<ConfidenceField>();
  current.forEach((session) => lowConfidenceFields(session).forEach((field) => lowFields.add(field)));

  return {
    known,
    seasonYear,
    status,
    lastVerifiedAt,
    sourceUrl,
    isStale: seasonYear !== null && seasonYear < ACTIVE_SEASON_YEAR,
    sessionsInSeason: current.length,
    lowConfidenceFields: Array.from(lowFields),
  };
}

export type TrustTone = 'confirmed' | 'checked' | 'stale' | 'unverified';

export interface TrustBadge {
  label: string;
  tone: TrustTone;
  /** The longer sentence — a tooltip on a card, visible text on the detail page. */
  detail: string;
}

// Deliberately no Tailwind classes in this file: tailwind.config.ts scans
// src/app, src/components and src/pages only, so a class named here and
// nowhere else is never generated and silently renders as nothing. The
// tone -> class map lives in TrustBadge.tsx.

/** "Nov 2026" in Richmond's timezone, so a check never appears to shift a month. */
export function formatCheckedAt(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'America/New_York',
  }).format(date);
}

/**
 * The one badge a card shows, or null when there is nothing worth saying.
 *
 * Staleness is checked before status on purpose: a 2026 week someone verified
 * carefully is still a 2026 week, and "Checked by Scouty" over last summer's
 * dates would be a true statement that misleads.
 */
export function trustBadge(trust: TrustSummary): TrustBadge | null {
  if (!trust.known) return null;

  const checked = formatCheckedAt(trust.lastVerifiedAt);

  if (trust.isStale) {
    const wasChecked = verificationRank(trust.status) >= RANK.human_checked;
    return {
      label: `${trust.seasonYear} dates`,
      tone: 'stale',
      detail: wasChecked
        ? `These are ${trust.seasonYear} sessions, checked ${checked ?? 'earlier'}. ${ACTIVE_SEASON_YEAR} dates are not out yet — confirm with the camp.`
        : `Last summer's schedule. We have no ${ACTIVE_SEASON_YEAR} dates for this camp yet — confirm with the camp before planning around it.`,
    };
  }

  switch (trust.status) {
    case 'camp_confirmed':
      return {
        label: 'Confirmed by camp',
        tone: 'confirmed',
        detail: `The camp confirmed these ${trust.seasonYear} details${checked ? ` in ${checked}` : ''}.`,
      };
    case 'human_checked':
      return {
        label: `Checked for ${trust.seasonYear}`,
        tone: 'checked',
        detail: `A person checked these details against the camp's own listing${checked ? ` in ${checked}` : ''}.`,
      };
    case 'auto':
      // Our pipeline's word for its own work. On a card it would read as a
      // guarantee; the detail page spells it out instead.
      return null;
    case 'unverified':
    default:
      return {
        label: 'Not verified',
        tone: 'unverified',
        detail: trust.seasonYear
          ? `We have not checked these ${trust.seasonYear} details against the camp yet.`
          : 'We have not checked these details against the camp yet.',
      };
  }
}

/** The provenance sentence for the detail page, where there is room to be plain. */
export function provenanceSentence(trust: TrustSummary): string {
  const checked = formatCheckedAt(trust.lastVerifiedAt);

  if (trust.status === 'auto') {
    return checked
      ? `Collected automatically from the camp's website in ${checked}, not yet checked by a person.`
      : "Collected automatically from the camp's website, not yet checked by a person.";
  }

  const badge = trustBadge(trust);
  return badge?.detail ?? 'We have not checked these details against the camp yet.';
}

/** "dates", "dates and price", "dates, price and ages". */
export function formatFieldList(fields: ConfidenceField[]): string {
  if (fields.length === 0) return '';
  if (fields.length === 1) return fields[0];
  return `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`;
}
