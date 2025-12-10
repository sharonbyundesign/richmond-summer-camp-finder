import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check environment variables first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          error: 'Server configuration error',
          details: 'Supabase credentials are not configured.',
          interests: []
        },
        { status: 500 }
      );
    }

    // Fetch all unique interests from camp_interests table
    const { data, error } = await supabase
      .from('camp_interests')
      .select('tag, interest_name')
      .order('interest_name', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Unable to load interests', interests: [] },
        { status: 500 }
      );
    }

    // Extract unique interest names/tags with case-insensitive deduplication
    const interestsMap = new Map<string, string>(); // lowercase -> original case
    
    if (data) {
      data.forEach((interest: { tag?: string | null; interest_name?: string | null }) => {
        // Add tag if present
        if (interest.tag && interest.tag.trim()) {
          const normalized = interest.tag.trim();
          const lower = normalized.toLowerCase();
          // Keep the first occurrence (or prefer capitalized version)
          if (!interestsMap.has(lower) || (normalized[0] === normalized[0].toUpperCase() && interestsMap.get(lower)?.[0] !== interestsMap.get(lower)?.[0].toUpperCase())) {
            interestsMap.set(lower, normalized);
          }
        }
        // Add interest_name if present
        if (interest.interest_name && interest.interest_name.trim()) {
          const normalized = interest.interest_name.trim();
          const lower = normalized.toLowerCase();
          // Keep the first occurrence (or prefer capitalized version)
          if (!interestsMap.has(lower) || (normalized[0] === normalized[0].toUpperCase() && interestsMap.get(lower)?.[0] !== interestsMap.get(lower)?.[0].toUpperCase())) {
            interestsMap.set(lower, normalized);
          }
        }
      });
    }

    // Convert to array and sort
    const interests = Array.from(interestsMap.values()).sort((a, b) => 
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    return NextResponse.json({ interests });
  } catch (err) {
    console.error('Unexpected error in interests API:', err);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while loading interests.',
        interests: []
      },
      { status: 500 }
    );
  }
}

