import { NextResponse } from 'next/server';

/**
 * The review tool writes to the production database with the service-role key,
 * so it is restricted to a local dev server rather than shipped behind a
 * password. A deployed build serves 404 for every /review route and the page
 * itself, which keeps the surface area at zero instead of at "one shared
 * secret".
 *
 * If this ever needs to be reachable from somewhere other than Sharon's
 * laptop, that is a real auth decision — not a flag to flip here.
 */
export function reviewDisabled(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return null;
}

/** The season we are collecting. Matches ACTIVE_SEASON_YEAR in src/lib/trust.ts. */
export const REVIEW_SEASON_YEAR = 2027;
