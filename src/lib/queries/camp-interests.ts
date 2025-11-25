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
 */
export async function getInterestsByCampId(campId: string): Promise<CampInterest[]> {
  const { data, error } = await supabase
    .from('camp_interests')
    .select('*')
    .eq('camp_id', campId)
    .order('interest_name', { ascending: true })

  if (error) {
    console.error('Error fetching camp interests:', error)
    throw error
  }

  return data || []
}


