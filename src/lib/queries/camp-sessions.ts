import { supabase } from '../supabase'
import type { CampSession } from '@/types/database'

/**
 * Fetch all camp sessions
 */
export async function getAllCampSessions(): Promise<CampSession[]> {
  const { data, error } = await supabase
    .from('camp_sessions')
    .select('*')
    .order('start_date', { ascending: true })

  if (error) {
    console.error('Error fetching camp sessions:', error)
    throw error
  }

  return data || []
}

/**
 * Fetch a single camp session by ID
 */
export async function getCampSessionById(id: string): Promise<CampSession | null> {
  const { data, error } = await supabase
    .from('camp_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching camp session:', error)
    throw error
  }

  return data
}

/**
 * Fetch all sessions for a specific camp
 */
export async function getSessionsByCampId(campId: string): Promise<CampSession[]> {
  const { data, error } = await supabase
    .from('camp_sessions')
    .select('*')
    .eq('camp_id', campId)
    .order('start_date', { ascending: true })

  if (error) {
    console.error('Error fetching camp sessions:', error)
    throw error
  }

  return data || []
}

/**
 * Fetch sessions within a date range
 */
export async function getSessionsByDateRange(
  startDate: string,
  endDate: string
): Promise<CampSession[]> {
  const { data, error } = await supabase
    .from('camp_sessions')
    .select('*')
    .gte('start_date', startDate)
    .lte('end_date', endDate)
    .order('start_date', { ascending: true })

  if (error) {
    console.error('Error fetching camp sessions by date range:', error)
    throw error
  }

  return data || []
}


