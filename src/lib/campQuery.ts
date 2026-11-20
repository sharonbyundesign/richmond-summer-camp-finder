// The column lists for the two camp reads, in one place so /api/camps and
// /api/camps/[id] cannot drift apart.
//
// Why this is not just a string constant: the trust columns from migration 001
// may not exist yet. This repo applies migrations by hand in the Supabase SQL
// editor, so a deployed build can be ahead of the database by hours or weeks.
// PostgREST fails the *whole* request when asked for a column that is not there
// (Postgres error 42703), which would take the camp list down rather than
// degrade it. So every read asks for the trust columns first and falls back to
// the base list, and the camp list keeps working either way.

import type { PostgrestError } from '@supabase/supabase-js';

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

const INTERESTS = `
  camp_interests(
    id,
    tag,
    interest_name
  )`;

function buildSelect(withTrust: boolean, extraCampColumns = '', extraSessionColumns = ''): string {
  const campCols = [CAMP_BASE, extraCampColumns, withTrust ? CAMP_TRUST : ''].filter(Boolean).join(',');
  const sessionCols = [SESSION_BASE, extraSessionColumns, withTrust ? SESSION_TRUST : '']
    .filter(Boolean)
    .join(',');

  return `${campCols},
  camp_sessions(${sessionCols}
  ),${INTERESTS}`;
}

/** Select for the list route. */
export function campListSelect(withTrust: boolean): string {
  return buildSelect(withTrust);
}

/** Select for the detail route, which also shows row timestamps. */
export function campDetailSelect(withTrust: boolean): string {
  return buildSelect(withTrust, '\n  created_at,\n  updated_at', '\n    created_at,\n    updated_at');
}

/**
 * True when the request failed only because a column is missing — i.e. the
 * trust migration has not been applied to this database yet. Anything else
 * (permissions, a dropped table, a bad JWT) must keep surfacing as a real
 * error instead of being quietly retried.
 */
export function isMissingColumnError(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  return /column .* does not exist/i.test(error.message ?? '');
}

// Whether this process has established that the trust columns exist. A positive
// result is cached for the life of the process; a negative one expires, so
// running the migration starts being picked up within a minute or two instead
// of waiting for every serverless instance to recycle.
const NEGATIVE_TTL_MS = 60_000;
let trustColumnsPresent: boolean | null = null;
let negativeCheckedAt = 0;

export function trustColumnsAssumedPresent(): boolean {
  if (trustColumnsPresent === true) return true;
  if (trustColumnsPresent === false && Date.now() - negativeCheckedAt < NEGATIVE_TTL_MS) return false;
  return true;
}

export function recordTrustColumnsPresent(present: boolean): void {
  trustColumnsPresent = present;
  if (!present) {
    negativeCheckedAt = Date.now();
    console.warn(
      '[camps] trust columns are missing — serving camps without provenance. ' +
        'Apply supabase/migrations/001_camp_trust_fields.up.sql to enable them.',
    );
  }
}
