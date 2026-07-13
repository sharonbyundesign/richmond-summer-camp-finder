import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { filterCamps, parseFiltersFromParams } from '@/lib/campFilters';
import { zipToLatLng } from '@/lib/richmondZips';

// Force dynamic rendering since we use request.url for query parameters
export const dynamic = 'force-dynamic';
// Never serve a cached Supabase response — `force-dynamic` only affects
// rendering, not Next's Data Cache for the outbound fetch, so deletes/edits
// in Supabase must be reflected immediately.
export const fetchCache = 'force-no-store';

// Type for the camp query result with relations
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
  }>;
  camp_interests?: Array<{
    id?: string;
    tag?: string;
    interest_name?: string;
  }>;
};

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

    // Query Supabase: camps with related sessions and interests (through join table)
    const { data, error } = await supabase
      .from('camps')
      .select(`
        id,
        name,
        location,
        description,
        website_url,
        image_url,
        latitude,
        longitude,
        day_type,
        zipcode_id,
        camp_sessions(
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
          capacity
        ),
        camp_interests(
          id,
          tag,
          interest_name
        )
      `)
      .order('name', { ascending: true });

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

    const camps = (data as CampWithRelations[] | null) || [];

    // Resolve the distance origin (if a recognized ZIP was entered) and apply
    // all filters through the shared logic used by both count and results.
    const origin = filters.zip ? zipToLatLng(filters.zip) : null;
    const filtered = filterCamps(camps, filters, origin);

    if (countOnly) {
      return NextResponse.json({ count: filtered.length });
    }

    return NextResponse.json({ camps: filtered });
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
