/**
 * Validation rules for extracted camp data — the single source of truth for
 * "does this look like a real Richmond summer camp session?".
 *
 * Two severities, and the difference is the whole point:
 *
 *   error    the value cannot be right. Never publish it.
 *   warning  the value is unusual. A human looks, and may well approve it.
 *
 * Nearly every rule here is a WARNING, because the data keeps proving that the
 * obvious hard limits are wrong about real camps. Jacob's Chance serves people
 * with disabilities and publishes sessions for ages 8-40; Let's Grow, Henrico!
 * is genuinely free, so price 0 is a fact and not a missing value. A validator
 * that rejected those would be quietly deleting true things about real camps,
 * which is worse for a parent than showing them something to double-check.
 *
 * The hard limits that ARE invariants live as CHECK constraints in
 * supabase/migrations/004_validation_constraints.up.sql. The thresholds are
 * duplicated between here and that file on purpose — SQL cannot import TS — so
 * any change has to be made in both. The constraint names in 004 match the rule
 * ids below.
 */

import { haversineMiles, type LatLng } from '@/lib/v2/geo';

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Typical camp-age span. Outside this is a warning, never an error. */
export const TYPICAL_AGE_MIN = 3;
export const TYPICAL_AGE_MAX = 18;

/** Ages outside this cannot describe a person at a camp. */
export const ABSOLUTE_AGE_MIN = 0;
export const ABSOLUTE_AGE_MAX = 99;

/** Per-session price in USD. 0 is valid and means free. */
export const TYPICAL_PRICE_MIN = 25;
export const TYPICAL_PRICE_MAX = 2500;
export const ABSOLUTE_PRICE_MAX = 5000;

/** A week of camp. Longer than this is almost always an end_date typo. */
export const MAX_SESSION_DAYS = 120;

/** Downtown Richmond, the origin every distance is measured from. */
export const RICHMOND_CENTER: LatLng = { lat: 37.5407, lng: -77.436 };

/**
 * The widest radius the search pill offers (RADIUS_OPTIONS in
 * src/lib/v2/usePillState.ts). A parent can ask for camps 50 miles out, so
 * anything we store has to be able to answer that — which reaches Ashland
 * (~16 mi), Petersburg and Pamplin Historical Park (~25 mi) with room to spare.
 */
export const SERVICE_RADIUS_MILES = 50;

/** Bounding box of the circle above. Mirrored by camps_richmond_bbox in 004. */
export const SERVICE_BBOX = {
  minLat: 36.81,
  maxLat: 38.27,
  minLng: -78.35,
  maxLng: -76.52,
} as const;

/**
 * The summer window, as month/day. Deliberately generous at both ends: a few
 * camps run a "pre-camp" week in late May and a wind-down week in early
 * September, and those are real sessions, not bad data.
 */
export const SEASON_START_MONTH_DAY = '05-15';
export const SEASON_END_MONTH_DAY = '09-15';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  field: string;
  rule: string;
  severity: Severity;
  message: string;
}

export interface ValidationResult {
  /** No errors. Warnings do not make a result invalid — they route it to review. */
  ok: boolean;
  issues: ValidationIssue[];
}

/** Only the fields the rules read, so this works on a DB row or extractor output. */
export interface SessionInput {
  start_date?: string | null;
  end_date?: string | null;
  price?: number | string | null;
  min_age?: number | null;
  max_age?: number | null;
}

export interface CampInput {
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inclusive date bounds for a season, as ISO `YYYY-MM-DD` strings. */
export function summerWindow(seasonYear: number): { start: string; end: string } {
  return {
    start: `${seasonYear}-${SEASON_START_MONTH_DAY}`,
    end: `${seasonYear}-${SEASON_END_MONTH_DAY}`,
  };
}

/**
 * Whole days between two ISO dates. Both are plain `YYYY-MM-DD`, so they are
 * parsed as UTC midnight — no timezone can shift the result by a day.
 */
function daysBetween(startIso: string, endIso: string): number {
  const ms = Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${startIso}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

const issue = (
  field: string,
  rule: string,
  severity: Severity,
  message: string,
): ValidationIssue => ({ field, rule, severity, message });

/**
 * An address too vague to place. Lifted from `isGeocodable` in
 * scripts/geocode-camps.mjs, whose comment puts it best: a bare "Richmond, VA"
 * geocodes to the city centroid, which is "a precise-looking pin that is a lie".
 * Centralised here so a vague address fails validation rather than quietly
 * producing a confident-looking marker.
 */
export function isVagueAddress(location?: string | null): boolean {
  if (!location) return true;

  const value = location.replace(/\s+/g, ' ').trim();
  if (!value) return true;

  if (/multiple|various|several|locations across|different locations|club locations/i.test(value)) {
    return true;
  }

  const parts = value
    .replace(/\b\d{5}(-\d{4})?\b/, '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const hasStreetNumber = /\d/.test(value);

  // "Richmond, VA" => 2 parts, no digits => city centroid only.
  return !(hasStreetNumber || parts.length > 2);
}

// ---------------------------------------------------------------------------
// Session rules
// ---------------------------------------------------------------------------

/** Dates present, ordered, plausibly long, and inside the target season. */
export function validateSessionDates(
  session: SessionInput,
  seasonYear: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { start_date: start, end_date: end } = session;

  if (!start || !end) {
    issues.push(
      issue(
        !start ? 'start_date' : 'end_date',
        'dates_present',
        'error',
        'A session without both dates cannot be shown to a parent.',
      ),
    );
    return issues;
  }

  if (!isIsoDate(start) || !isIsoDate(end)) {
    issues.push(issue('start_date', 'dates_parseable', 'error', 'Dates must be YYYY-MM-DD.'));
    return issues;
  }

  if (start > end) {
    issues.push(
      issue('end_date', 'date_order', 'error', `end_date ${end} is before start_date ${start}.`),
    );
  }

  const span = daysBetween(start, end);
  if (span > MAX_SESSION_DAYS) {
    issues.push(
      issue(
        'end_date',
        'duration_sane',
        'error',
        `Session spans ${span} days — almost certainly an end_date typo.`,
      ),
    );
  }

  // The season check: this is why season_year is passed in rather than inferred
  // from the dates. "These 2026 dates were extracted as 2027 data" is exactly
  // the failure we are trying to catch, and inferring the year would hide it.
  const { start: windowStart, end: windowEnd } = summerWindow(seasonYear);
  if (start < windowStart || start > windowEnd) {
    issues.push(
      issue(
        'start_date',
        'in_season',
        'warning',
        `start_date ${start} is outside summer ${seasonYear} (${windowStart}..${windowEnd}).`,
      ),
    );
  }
  if (end < windowStart || end > windowEnd) {
    issues.push(
      issue(
        'end_date',
        'in_season',
        'warning',
        `end_date ${end} is outside summer ${seasonYear} (${windowStart}..${windowEnd}).`,
      ),
    );
  }

  return issues;
}

/**
 * Ages. The 3..18 band is a warning only — see the file header on Jacob's
 * Chance, which runs real sessions for ages up to 40.
 */
export function validateSessionAges(session: SessionInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { min_age: min, max_age: max } = session;

  for (const [field, value] of [
    ['min_age', min],
    ['max_age', max],
  ] as const) {
    if (value == null) continue;

    if (!Number.isInteger(value) || value < ABSOLUTE_AGE_MIN || value > ABSOLUTE_AGE_MAX) {
      issues.push(
        issue(field, 'age_sane', 'error', `${field} ${value} is not a possible age.`),
      );
    } else if (value < TYPICAL_AGE_MIN || value > TYPICAL_AGE_MAX) {
      issues.push(
        issue(
          field,
          'age_typical',
          'warning',
          `${field} ${value} is outside the usual ${TYPICAL_AGE_MIN}..${TYPICAL_AGE_MAX} — ` +
            'correct for an inclusive or adult-serving camp, so confirm rather than clamp.',
        ),
      );
    }
  }

  if (min != null && max != null && min > max) {
    issues.push(
      issue('min_age', 'age_order', 'error', `min_age ${min} is above max_age ${max}.`),
    );
  }

  return issues;
}

/** Price. `null` means unknown and is fine; `0` means free and is also fine. */
export function validateSessionPrice(session: SessionInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (session.price == null) return issues;

  const price = typeof session.price === 'string' ? Number(session.price) : session.price;

  if (!Number.isFinite(price) || price < 0 || price > ABSOLUTE_PRICE_MAX) {
    issues.push(issue('price', 'price_sane', 'error', `price ${session.price} is not a usable amount.`));
    return issues;
  }

  // Flagged, not rejected: a free county program is real, but so is a scraper
  // that picked up "$0" from an empty cell.
  if (price === 0) {
    issues.push(
      issue('price', 'price_free', 'warning', 'price is 0 — confirm the session is genuinely free.'),
    );
  } else if (price < TYPICAL_PRICE_MIN || price > TYPICAL_PRICE_MAX) {
    issues.push(
      issue(
        'price',
        'price_typical',
        'warning',
        `price ${price} is outside the usual $${TYPICAL_PRICE_MIN}..$${TYPICAL_PRICE_MAX}.`,
      ),
    );
  }

  return issues;
}

export function validateSession(session: SessionInput, seasonYear: number): ValidationResult {
  const issues = [
    ...validateSessionDates(session, seasonYear),
    ...validateSessionAges(session),
    ...validateSessionPrice(session),
  ];
  return { ok: !issues.some((i) => i.severity === 'error'), issues };
}

// ---------------------------------------------------------------------------
// Camp rules
// ---------------------------------------------------------------------------

/** Coordinates inside the service area, and an address specific enough to place. */
export function validateCampLocation(camp: CampInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { latitude: lat, longitude: lng } = camp;

  if ((lat == null) !== (lng == null)) {
    issues.push(
      issue('latitude', 'coords_paired', 'error', 'Half a coordinate puts a pin in the ocean.'),
    );
  }

  if (isVagueAddress(camp.location)) {
    issues.push(
      issue(
        'location',
        'address_specific',
        'warning',
        'Address is too vague to place precisely — leave coordinates NULL rather than ' +
          'pinning the city centroid.',
      ),
    );
  }

  if (lat != null && lng != null) {
    const outsideBox =
      lat < SERVICE_BBOX.minLat ||
      lat > SERVICE_BBOX.maxLat ||
      lng < SERVICE_BBOX.minLng ||
      lng > SERVICE_BBOX.maxLng;

    if (outsideBox) {
      issues.push(
        issue(
          'latitude',
          'richmond_bbox',
          'error',
          `(${lat}, ${lng}) is outside the Richmond service area — likely a bad geocode.`,
        ),
      );
    } else {
      const miles = haversineMiles(RICHMOND_CENTER, { lat, lng });
      if (miles > SERVICE_RADIUS_MILES) {
        issues.push(
          issue(
            'latitude',
            'service_radius',
            'warning',
            `${miles.toFixed(1)} mi from downtown, beyond the ${SERVICE_RADIUS_MILES} mi ` +
              'the search pill can ask for — no parent would find this camp.',
          ),
        );
      }
    }
  }

  return { ok: !issues.some((i) => i.severity === 'error'), issues };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/**
 * The status an extracted change should enter the queue with. Note that an
 * error does NOT mean 'rejected': only a human rejects. A proposal we believe
 * is wrong still goes to review, because the alternative is a crawler quietly
 * discarding the one camp whose data is unusual but true.
 */
export function stagingStatusFor(result: ValidationResult): 'pending' | 'needs_review' {
  return result.issues.length === 0 ? 'pending' : 'needs_review';
}

/** Shape stored in `camp_updates.validation`. */
export function toValidationJson(result: ValidationResult) {
  return { ok: result.ok, issues: result.issues };
}
