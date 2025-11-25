import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Type for the camp query result with relations
type CampWithRelations = {
  id: string;
  name: string;
  location?: string;
  min_age?: number;
  max_age?: number;
  description?: string;
  website_url?: string;
  camp_sessions?: Array<{
    start_date?: string;
    end_date?: string;
    label?: string;
  }>;
  camp_interests?: Array<{
    tag?: string;
  }>;
};

export async function GET(request: Request) {
  try {
    // Check environment variables first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          error: 'Server configuration error',
          details: 'Supabase credentials are not configured. Please check your environment variables.',
          camps: []
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const age = searchParams.get('age');
    const interests = searchParams.getAll('interest'); // ?interest=STEM&interest=Art
    const week = searchParams.get('week');             // e.g. "2025-06-10"

    // Query Supabase: camps with related sessions and interests
    const { data, error } = await supabase
      .from('camps')
      .select(`
        id,
        name,
        location,
        min_age,
        max_age,
        description,
        website_url,
        camp_sessions(start_date, end_date, label),
        camp_interests(tag)
      `)
      .order('name', { ascending: true });

    // Handle Supabase errors with friendly messages
    if (error) {
      console.error('Supabase error:', error);
      
      // Provide user-friendly error messages based on error type
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
      
      return NextResponse.json(
        { error: errorMessage, camps: [] },
        { status: 500 }
      );
    }

    // Handle case where data is null or undefined
    if (!data) {
      return NextResponse.json({ camps: [] });
    }

    // Filter camps based on query parameters
    let filteredCamps: CampWithRelations[] = data as CampWithRelations[];

    // Filter by age: age must be between min_age and max_age
    if (age) {
      const ageNum = parseInt(age, 10);
      if (!isNaN(ageNum) && ageNum > 0) {
        filteredCamps = filteredCamps.filter(camp => {
          const minAge = camp.min_age ?? 0;
          const maxAge = camp.max_age ?? 18;
          return minAge <= ageNum && maxAge >= ageNum;
        });
      }
    }

    // Filter by interests: camp must have at least one of the selected interest tags
    if (interests.length > 0) {
      filteredCamps = filteredCamps.filter(camp => {
        const campTags = (camp.camp_interests || [])
          .map((ci) => ci?.tag)
          .filter((tag): tag is string => tag != null);
        return interests.some(interest => campTags.includes(interest));
      });
    }

    // Filter by week: week must fall between start_date and end_date of at least one session
    if (week) {
      try {
        const weekDate = new Date(week);
        if (!isNaN(weekDate.getTime())) {
          filteredCamps = filteredCamps.filter(camp => {
            const sessions = camp.camp_sessions || [];
            return sessions.some((session) => {
              if (!session.start_date || !session.end_date) return false;
              
              try {
                const startDate = new Date(session.start_date);
                const endDate = new Date(session.end_date);
                return weekDate >= startDate && weekDate <= endDate;
              } catch {
                return false;
              }
            });
          });
        }
      } catch (dateError) {
        console.error('Error parsing week date:', dateError);
        // Continue without week filtering if date is invalid
      }
    }

    return NextResponse.json({ camps: filteredCamps });
  } catch (err) {
    // Handle unexpected errors
    console.error('Unexpected error in camps API:', err);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while loading camps. Please try again later.',
        camps: []
      },
      { status: 500 }
    );
  }
}

