import { supabase } from '../supabase'
import type { CampInterest } from '@/types/database'

/**
 * Fetch all camp interests
 */
export async function getAllCampInterests(): Promise<CampInterest[]> {
  const { data, error } = await supabase
    .from('camp_interests')
    .select('*')
    .order('interest_name', { ascending: true })

  if (error) {
    console.error('Error fetching camp interests:', error)
    throw error
  }

  return data || []
}

/**
 * Fetch a single camp interest by ID
 */
export async function getCampInterestById(id: string): Promise<CampInterest | null> {
  const { data, error } = await supabase
    .from('camp_interests')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching camp interest:', error)
    throw error
  }

  return data
}

/**
 * Fetch all interests for a specific camp
 * NOTE: This function is deprecated - camp_interests no longer has a camp_id column.
 * The relationship structure has changed. You may need to use a junction table or
 * a different approach to link interests to camps.
 */
export async function getInterestsByCampId(campId: string): Promise<CampInterest[]> {
  // TODO: Update this function based on the new relationship structure
  console.warn('getInterestsByCampId is deprecated - camp_interests relationship has changed');
  return []
  
  // Old implementation (no longer works):
  // const { data, error } = await supabase
  //   .from('camp_interests')
  //   .select('*')
  //   .eq('camp_id', campId)
  //   .order('interest_name', { ascending: true })
  //
  // if (error) {
  //   console.error('Error fetching camp interests:', error)
  //   throw error
  // }
  //
  // return data || []
}


