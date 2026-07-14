import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { toCategories } from '@/lib/interest-categories';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Server configuration error',
          details: 'Supabase credentials are not configured.',
          interests: [],
        },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from('camp_interests')
      .select('tag, interest_name');

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Unable to load interests', interests: [] },
        { status: 500 }
      );
    }

    // Collapse every raw tag onto the canonical 9-category taxonomy and return
    // only the categories that are actually present, in fixed display order.
    const rows = (data ?? []) as Array<{
      tag?: string | null;
      interest_name?: string | null;
    }>;
    const interests = toCategories(
      rows.flatMap((row) => [row.tag, row.interest_name])
    );

    return NextResponse.json({ interests });
  } catch (err) {
    console.error('Unexpected error in interests API:', err);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while loading interests.',
        interests: [],
      },
      { status: 500 }
    );
  }
}
