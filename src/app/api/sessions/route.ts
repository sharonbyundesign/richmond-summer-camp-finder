import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET to fetch sessions by IDs
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionIds = searchParams.getAll('id'); // ?id=xxx&id=yyy

    if (sessionIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    // Query Supabase: sessions with camp information
    const { data, error } = await supabase
      .from('camp_sessions')
      .select(`
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
        capacity,
        camp_id,
        camps(
          id,
          name,
          location
        )
      `)
      .in('id', sessionIds)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Unable to load sessions', sessions: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessions: data || [] });
  } catch (err) {
    console.error('Unexpected error in sessions API:', err);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while loading sessions.',
        sessions: []
      },
      { status: 500 }
    );
  }
}

