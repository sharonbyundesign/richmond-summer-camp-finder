import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { filterCamps, parseFiltersFromParams, undatedCamps } from '@/lib/campFilters';
import { zipToLatLng } from '@/lib/richmondZips';
import { campListSelect, selectWithFallback } from '@/lib/campQuery';
import { applyServiceArea, type CampLocation } from '@/lib/locations';
import type { VerificationStatus } from '@/types/database';

// Force dynamic rendering since we use request.url for query parameters
export const dynamic = 'force-dynamic';
// Never serve a cached Supabase response — `force-dynamic` only affects
// rendering, not Next's Data Cache for the outbound fetch, so deletes/edits
// in Supabase must be reflected immediately.
export const fetchCache = 'force-no-store';

type SupabaseServerClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

// Type for the camp query result with relations. The trust fields are optional
// because they are absent until migration 001 is applied — see campQuery.ts.
type CampWithRelations = {
  id: string;
  name: string;
  location?: string;
  description?: string;
  website_url?: string;
  image_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  day_type?: string | null;
  zipcode_id?: number;
  source_url?: string | null;
  season_year?: number | null;
  last_verified_at?: string | null;
  verification_status?: VerificationStatus;
  camp_sessions?: Array<{
    id?: string;
    name?: string;
    label?: string;
    start_date?: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    days_of_week?: string[];
    min_age?: number;
    max_age?: number;
    price?: number;
    capacity?: number;
    source_url?: string | null;
    season_year?: number | null;
    last_verified_at?: string | null;
    verification_status?: VerificationStatus;
    confidence_dates?: number | null;
    confidence_price?: number | null;
    confidence_ages?: number | null;
    /** The site this session runs at (migration 007). */
    location_id?: string | null;
  }>;
  camp_interests?: Array<{
    id?: string;
    tag?: string;
    interest_name?: string;
  }>;
  /** Absent until migration 007 is applied. */
  camp_locations?: CampLocation[];
};

/**
 * Camps with their sessions, interests, provenance and sites, asking for each
 * optional piece of schema the database is believed to have and dropping
 * whichever one it reports missing — so a database without migration 001 or
 * 007 serves the same camps, minus badges or sites, rather than failing.
 *
 * Out-of-area sites and their sessions are removed here, once, so nothing
 * downstream can show them.
 */
async function fetchCamps(supabase: SupabaseServerClient) {
  const result = await selectWithFallback((features) =>
    supabase.from('camps').select(campListSelect(features)).order('name', { ascending: true }),
  );

  if (result.error) return { camps: [] as CampWithRelations[], error: result.error };

  const camps = ((result.data as unknown as CampWithRelations[] | null) ?? []).map((camp) =>
    applyServiceArea(camp),
  );
  return { camps, error: null };
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Server configuration error',
          details: 'Supabase credentials are not configured. Please check your environment variables.',
          camps: [],
        },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get('count') === '1';
    const filters = parseFiltersFromParams(searchParams);

    const { camps, error } = await fetchCamps(supabase);

    if (error) {
      console.error('Supabase error:', error);

      let errorMessage = 'Unable to load camps at this time.';
      if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        errorMessage = 'The camps database is not set up correctly. Please contact support.';
      } else if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
        errorMessage = 'You do not have permission to access this data.';
      } else if (error.message?.includes('JWT') || error.message?.includes('authentication')) {
        errorMessage = 'Authentication error. Please check your connection settings.';
      } else if (error.message) {
        errorMessage = `Database error: ${error.message}`;
      }

      return NextResponse.json({ error: errorMessage, camps: [] }, { status: 500 });
    }

    // Resolve the distance origin (if a recognized ZIP was entered) and apply
    // all filters through the shared logic used by both count and results.
    const origin = filters.zip ? zipToLatLng(filters.zip) : null;
    const filtered = filterCamps(camps, filters, origin);

    if (countOnly) {
      return NextResponse.json({ count: filtered.length });
    }

    // Camps we hold no sessions for, narrowed by the filters that do not need
    // them. Returned alongside rather than mixed in: every session-level
    // filter excludes them by construction, so without this they disappear
    // from the results with no explanation — and that is most of the
    // catalogue. The client decides when to show them.
    const undated = undatedCamps(camps, filters, origin);

    return NextResponse.json({ camps: filtered, undated });
  } catch (err) {
    console.error('Unexpected error in camps API:', err);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while loading camps. Please try again later.',
        camps: [],
      },
      { status: 500 },
    );
  }
}
