// The column lists for the camp reads, in one place so /api/camps and
// /api/camps/[id] cannot drift apart.
//
// Why this is not just a string constant: this repo applies migrations by hand
// in the Supabase SQL editor, so a deployed build can be ahead of the database
// by hours or weeks. PostgREST fails the *whole* request when asked for a
// column or relationship that is not there, which would take the camp list
// down rather than degrade it. So each read asks for every optional piece of
// schema it knows about, and peels off whichever one the database reports
// missing — the camp list keeps working whatever state the database is in.

import type { PostgrestError } from '@supabase/supabase-js';

/** Optional schema a read can include, each tied to the migration that adds it. */
export interface SelectFeatures {
  /** Provenance columns on camps and camp_sessions (migration 001). */
  trust: boolean;
  /** camp_locations and camp_sessions.location_id (migration 007). */
  locations: boolean;
}

/** Camp columns the app has always read. */
const CAMP_BASE = `
  id,
  name,
  location,
  description,
  website_url,
  image_url,
  latitude,
  longitude,
  day_type,
  zipcode_id`;

/** Provenance on the camp row itself (migration 001). */
const CAMP_TRUST = `
  source_url,
  season_year,
  last_verified_at,
  verification_status`;

/** Session columns the app has always read. */
const SESSION_BASE = `
    id,
    name,
    label,
    start_date,
    end_date,
    start_time,
    end_time,
    days_of_week,
    min_age,
    max_age,
    price,
    capacity`;

/**
 * Provenance per session. Sessions carry their own because that is the unit a
 * parent acts on: one week can be confirmed by the camp while the next five are
 * last year's guesses, and a single camp-level badge cannot say that.
 */
const SESSION_TRUST = `
    source_url,
    season_year,
    last_verified_at,
    verification_status,
    confidence_dates,
    confidence_price,
    confidence_ages`;

/** Which site a session runs at (migration 007). */
const SESSION_LOCATION = `
    location_id`;

const INTERESTS = `
  camp_interests(
    id,
    tag,
    interest_name
  )`;

/** Every site a camp runs at (migration 007). */
const LOCATIONS = `
  camp_locations(
    id,
    name,
    address,
    latitude,
    longitude,
    outside_service_area
  )`;

function buildSelect(features: SelectFeatures, extraCampColumns = '', extraSessionColumns = ''): string {
  const campCols = [CAMP_BASE, extraCampColumns, features.trust ? CAMP_TRUST : '']
    .filter(Boolean)
    .join(',');
  const sessionCols = [
    SESSION_BASE,
    extraSessionColumns,
    features.trust ? SESSION_TRUST : '',
    features.locations ? SESSION_LOCATION : '',
  ]
    .filter(Boolean)
    .join(',');

  return `${campCols},
  camp_sessions(${sessionCols}
  ),${INTERESTS}${features.locations ? `,${LOCATIONS}` : ''}`;
}

/** Select for the list route. updated_at feeds the "Recently updated" sort. */
export function campListSelect(features: SelectFeatures): string {
  return buildSelect(features, '\n  updated_at', '\n    updated_at');
}

/** Select for the detail route, which also shows row timestamps. */
export function campDetailSelect(features: SelectFeatures): string {
  return buildSelect(features, '\n  created_at,\n  updated_at', '\n    created_at,\n    updated_at');
}

/**
 * True when the request failed only because some schema is missing — a column
 * (42703) or an embedded relationship PostgREST cannot find (PGRST200).
 * Anything else (permissions, a bad JWT, a real outage) must keep surfacing as
 * an error instead of being quietly retried.
 */
export function isMissingSchemaError(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST200') return true;
  return /column .* does not exist|could not find a relationship/i.test(error.message ?? '');
}

/** Kept for callers that only care about columns. */
export const isMissingColumnError = isMissingSchemaError;

/** Which feature a missing-schema error is about. */
function featureBlamedBy(error: PostgrestError, features: SelectFeatures): keyof SelectFeatures | null {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`;
  if (features.locations && (error.code === 'PGRST200' || /location/i.test(text))) return 'locations';
  if (features.trust) return 'trust';
  if (features.locations) return 'locations';
  return null;
}

// Whether this process has established that each feature exists. A positive
// result is cached for the life of the process; a negative one expires, so
// applying a migration is picked up within a minute instead of waiting for
// every serverless instance to recycle.
const NEGATIVE_TTL_MS = 60_000;
const present: Record<keyof SelectFeatures, boolean | null> = { trust: null, locations: null };
const negativeAt: Record<keyof SelectFeatures, number> = { trust: 0, locations: 0 };

const MIGRATION_FOR: Record<keyof SelectFeatures, string> = {
  trust: '001_camp_trust_fields',
  locations: '007_camp_locations',
};

function assumed(feature: keyof SelectFeatures): boolean {
  if (present[feature] === true) return true;
  if (present[feature] === false && Date.now() - negativeAt[feature] < NEGATIVE_TTL_MS) return false;
  return true;
}

function record(feature: keyof SelectFeatures, isPresent: boolean): void {
  present[feature] = isPresent;
  if (!isPresent) {
    negativeAt[feature] = Date.now();
    console.warn(
      `[camps] ${feature} schema is missing — serving camps without it. ` +
        `Apply supabase/migrations/${MIGRATION_FOR[feature]}.up.sql to enable it.`,
    );
  }
}

/** Back-compat for code written before locations existed. */
export function trustColumnsAssumedPresent(): boolean {
  return assumed('trust');
}
export function recordTrustColumnsPresent(isPresent: boolean): void {
  record('trust', isPresent);
}

/**
 * Run a camp read with every optional feature the database is believed to
 * have, dropping whichever one it reports missing and retrying. Returns the
 * features the successful read used, so callers can tell "no locations yet"
 * from "this camp has no locations".
 */
export async function selectWithFallback<T>(
  run: (features: SelectFeatures) => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<{ data: T | null; error: PostgrestError | null; features: SelectFeatures }> {
  let features: SelectFeatures = { trust: assumed('trust'), locations: assumed('locations') };

  // At most one retry per feature, plus the final attempt.
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await run(features);

    if (!result.error) {
      (Object.keys(features) as Array<keyof SelectFeatures>).forEach((f) => {
        if (features[f]) record(f, true);
      });
      return { ...result, features };
    }

    if (!isMissingSchemaError(result.error)) return { ...result, features };

    const blamed = featureBlamedBy(result.error, features);
    if (!blamed) return { ...result, features };

    record(blamed, false);
    features = { ...features, [blamed]: false };
  }

  const last = await run(features);
  return { ...last, features };
}
