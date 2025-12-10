import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering since we use request.url for query parameters
export const dynamic = 'force-dynamic';

// Type for the camp query result with relations
type CampWithRelations = {
  id: string;
  name: string;
  location?: string;
  description?: string;
  website_url?: string;
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
    const childId = searchParams.get('childId');
    const age = searchParams.get('age');
    const interests = searchParams.getAll('interest');
    const dateRangeStart = searchParams.get('dateRangeStart');
    const dateRangeEnd = searchParams.get('dateRangeEnd');
    const daysOfWeek = searchParams.getAll('daysOfWeek');
    const timeOfDay = searchParams.get('timeOfDay'); // 'morning', 'afternoon', 'full-day'
    const zipcode = searchParams.get('zipcode');
    const maxDistance = searchParams.get('maxDistance');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const hideConflicts = searchParams.get('hideConflicts') === 'true';

    // Query Supabase: camps with related sessions and interests (through join table)
    const { data, error } = await supabase
      .from('camps')
      .select(`
        id,
        name,
        location,
        description,
        website_url,
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

    // Filter by age: age must be between min_age and max_age of at least one session
    if (age) {
      const ageNum = parseInt(age, 10);
      if (!isNaN(ageNum) && ageNum > 0) {
        filteredCamps = filteredCamps.filter(camp => {
          const sessions = camp.camp_sessions || [];
          return sessions.some((session) => {
            const minAge = session.min_age ?? 0;
            const maxAge = session.max_age ?? 18;
            return minAge <= ageNum && maxAge >= ageNum;
          });
        });
      }
    }

    // Filter by interests: camp must have at least one of the selected interest tags
    if (interests.length > 0) {
      filteredCamps = filteredCamps.filter(camp => {
        const campTags = (camp.camp_interests || [])
          .map((ci) => ci?.tag || ci?.interest_name)
          .filter((tag): tag is string => tag != null);
        return interests.some(interest => campTags.includes(interest));
      });
    }

    // Filter by date range: sessions must overlap with the date range
    if (dateRangeStart || dateRangeEnd) {
      try {
        const startDate = dateRangeStart ? new Date(dateRangeStart) : null;
        const endDate = dateRangeEnd ? new Date(dateRangeEnd) : null;
        
        if (startDate || endDate) {
          filteredCamps = filteredCamps.filter(camp => {
            const sessions = camp.camp_sessions || [];
            return sessions.some((session) => {
              if (!session.start_date || !session.end_date) return false;
              
              try {
                const sessionStart = new Date(session.start_date);
                const sessionEnd = new Date(session.end_date);
                
                // Check if date ranges overlap
                if (startDate && endDate) {
                  return (sessionStart <= endDate && sessionEnd >= startDate);
                } else if (startDate) {
                  return sessionEnd >= startDate;
                } else if (endDate) {
                  return sessionStart <= endDate;
                }
                return false;
              } catch {
                return false;
              }
            });
          });
        }
      } catch (dateError) {
        console.error('Error parsing date range:', dateError);
      }
    }

    // Filter by days of week: session must include at least one selected day
    if (daysOfWeek.length > 0) {
      filteredCamps = filteredCamps.filter(camp => {
        const sessions = camp.camp_sessions || [];
        return sessions.some((session) => {
          const sessionDays = session.days_of_week || [];
          return daysOfWeek.some(day => sessionDays.includes(day));
        });
      });
    }

    // Filter by time of day
    if (timeOfDay) {
      filteredCamps = filteredCamps.filter(camp => {
        const sessions = camp.camp_sessions || [];
        return sessions.some((session) => {
          if (!session.start_time || !session.end_time) return false;
          
          try {
            const [startHour] = session.start_time.split(':').map(Number);
            const [endHour] = session.end_time.split(':').map(Number);
            
            if (timeOfDay === 'morning') {
              // Morning: typically 8 AM - 12 PM
              return startHour < 12;
            } else if (timeOfDay === 'afternoon') {
              // Afternoon: typically 12 PM - 5 PM
              return startHour >= 12 && endHour < 17;
            } else if (timeOfDay === 'full-day') {
              // Full day: spans both morning and afternoon
              return startHour < 12 && endHour >= 17;
            }
            return false;
          } catch {
            return false;
          }
        });
      });
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      const minPriceNum = minPrice ? parseFloat(minPrice) : 0;
      const maxPriceNum = maxPrice ? parseFloat(maxPrice) : Infinity;
      
      if (!isNaN(minPriceNum) || !isNaN(maxPriceNum)) {
        filteredCamps = filteredCamps.filter(camp => {
          const sessions = camp.camp_sessions || [];
          return sessions.some((session) => {
            const price = session.price ?? 0;
            return price >= minPriceNum && price <= maxPriceNum;
          });
        });
      }
    }

    // Filter by distance (using zipcode)
    if (zipcode && maxDistance) {
      try {
        const maxDistanceNum = parseFloat(maxDistance);
        if (!isNaN(maxDistanceNum) && maxDistanceNum > 0) {
          // Use the get_camps_by_zip function if available
          // For now, we'll filter client-side based on zipcode_id
          // This would ideally use the database function for accurate distance calculation
          // Note: This is a simplified version - you may want to use the get_camps_by_zip function
          filteredCamps = filteredCamps.filter(camp => {
            // If camp has zipcode_id, we'd need to calculate distance
            // For now, we'll just return all camps and let the database function handle it
            return true;
          });
        }
      } catch (distanceError) {
        console.error('Error parsing distance:', distanceError);
      }
    }

    // Filter out conflicts with saved sessions
    if (hideConflicts && childId) {
      try {
        // Fetch saved sessions for the child
        const { data: savedSessions, error: savedError } = await supabase
          .from('saved_child_sessions')
          .select(`
            camp_session_id,
            camp_sessions(
              start_date,
              end_date,
              start_time,
              end_time,
              days_of_week
            )
          `)
          .eq('child_profile_id', parseInt(childId, 10))
          .eq('save_status', 'saved');

        if (!savedError && savedSessions) {
          const conflictSessionIds = new Set<string>();
          
          // Extract session details for conflict checking
          savedSessions.forEach((saved: any) => {
            if (saved.camp_sessions) {
              const session = Array.isArray(saved.camp_sessions) ? saved.camp_sessions[0] : saved.camp_sessions;
              if (session) {
                conflictSessionIds.add(saved.camp_session_id);
              }
            }
          });

          // Filter out camps with conflicting sessions
          filteredCamps = filteredCamps.filter(camp => {
            const sessions = camp.camp_sessions || [];
            return !sessions.some((session) => {
              if (!session.id) return false;
              
              // Check if this session conflicts with any saved session
              return savedSessions.some((saved: any) => {
                const savedSession = Array.isArray(saved.camp_sessions) ? saved.camp_sessions[0] : saved.camp_sessions;
                if (!savedSession) return false;
                
                // Check date overlap
                if (session.start_date && session.end_date && savedSession.start_date && savedSession.end_date) {
                  const sessionStart = new Date(session.start_date);
                  const sessionEnd = new Date(session.end_date);
                  const savedStart = new Date(savedSession.start_date);
                  const savedEnd = new Date(savedSession.end_date);
                  
                  const datesOverlap = (sessionStart <= savedEnd && sessionEnd >= savedStart);
                  
                  if (!datesOverlap) return false;
                  
                  // Check time overlap if both have times
                  if (session.start_time && session.end_time && savedSession.start_time && savedSession.end_time) {
                    const sessionStartTime = session.start_time;
                    const sessionEndTime = session.end_time;
                    const savedStartTime = savedSession.start_time;
                    const savedEndTime = savedSession.end_time;
                    
                    // Check if times overlap
                    const timesOverlap = (sessionStartTime <= savedEndTime && sessionEndTime >= savedStartTime);
                    if (!timesOverlap) return false;
                  }
                  
                  // Check days overlap
                  const sessionDays = session.days_of_week || [];
                  const savedDays = savedSession.days_of_week || [];
                  const daysOverlap = sessionDays.some((day: string) => savedDays.includes(day));
                  
                  return daysOverlap;
                }
                
                return false;
              });
            });
          });
        }
      } catch (conflictError) {
        console.error('Error checking conflicts:', conflictError);
        // Continue without conflict filtering if there's an error
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

