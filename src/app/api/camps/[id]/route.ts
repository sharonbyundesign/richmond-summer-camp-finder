import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check environment variables first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          error: 'Server configuration error',
          details: 'Supabase credentials are not configured.',
        },
        { status: 500 }
      );
    }

    const { id: campId } = await params;

    // Query Supabase: single camp with all related sessions and interests
    const { data, error } = await supabase
      .from('camps')
      .select(`
        id,
        name,
        location,
        description,
        website_url,
        zipcode_id,
        created_at,
        updated_at,
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
          capacity,
          created_at,
          updated_at
        ),
        camp_interests(
          id,
          tag,
          interest_name
        )
      `)
      .eq('id', campId)
      .single();

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

