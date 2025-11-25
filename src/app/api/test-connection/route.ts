import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Check if environment variables are set
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing environment variables',
          details: 'Please ensure .env.local contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
        },
        { status: 500 }
      );
    }

    // Test connection by querying camps table
    const { data, error } = await supabase
      .from('camps')
      .select('id, name')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Table "camps" does not exist',
            details: 'Please run the SQL migration in supabase-migration.sql',
            errorMessage: error.message,
            errorCode: error.code,
          },
          { status: 500 }
        );
      } else if (error.code === 'PGRST301') {
        return NextResponse.json(
          {
            success: false,
            error: 'Permission denied',
            details: 'Check your RLS policies in Supabase',
            errorMessage: error.message,
            errorCode: error.code,
          },
          { status: 500 }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Database error',
            errorMessage: error.message,
            errorCode: error.code,
          },
          { status: 500 }
        );
      }
    }

    // Test related tables
    const [sessionsResult, interestsResult] = await Promise.all([
      supabase.from('camp_sessions').select('id').limit(1),
      supabase.from('camp_interests').select('id').limit(1),
    ]);

    const results = {
      success: true,
      message: 'Successfully connected to Supabase!',
      camps: {
        accessible: true,
        count: data?.length || 0,
      },
      camp_sessions: {
        accessible: !sessionsResult.error,
        error: sessionsResult.error?.message,
      },
      camp_interests: {
        accessible: !interestsResult.error,
        error: interestsResult.error?.message,
      },
    };

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unexpected error',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

