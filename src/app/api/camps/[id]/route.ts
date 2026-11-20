import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import {
  campDetailSelect,
  isMissingColumnError,
  recordTrustColumnsPresent,
  trustColumnsAssumedPresent,
} from '@/lib/campQuery';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
// Never serve a cached Supabase response so DB changes show up immediately.
export const fetchCache = 'force-no-store';

type SupabaseServerClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

/**
 * One camp with its sessions, interests and provenance. As in the list route,
 * a database that has not had migration 001 applied yet serves the camp
 * without the trust columns instead of failing.
 */
async function fetchCamp(supabase: SupabaseServerClient, campId: string) {
  const run = (withTrust: boolean) =>
    supabase.from('camps').select(campDetailSelect(withTrust)).eq('id', campId).single();

  const wantTrust = trustColumnsAssumedPresent();
  const first = await run(wantTrust);

  if (!first.error) {
    if (wantTrust) recordTrustColumnsPresent(true);
    return first;
  }

  if (wantTrust && isMissingColumnError(first.error)) {
    recordTrustColumnsPresent(false);
    return run(false);
  }

  return first;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check environment variables first
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Server configuration error',
          details: 'Supabase credentials are not configured.',
        },
        { status: 500 }
      );
    }

    const { id: campId } = await params;

    const { data, error } = await fetchCamp(supabase, campId);

    // Handle Supabase errors
    if (error) {
      console.error('Supabase error:', error);

      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Camp not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Unable to load camp details' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Camp not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ camp: data });
  } catch (err) {
    console.error('Unexpected error in camp detail API:', err);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while loading camp details.',
      },
      { status: 500 }
    );
  }
}
