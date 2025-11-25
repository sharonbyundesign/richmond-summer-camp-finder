import { supabase } from '../supabase'
import type { Camp } from '@/types/database'

/**
 * Fetch all camps
 */
export async function getAllCamps(): Promise<Camp[]> {
  const { data, error } = await supabase
    .from('camps')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching camps:', error)
    throw error
  }

  return data || []
}

/**
 * Fetch a single camp by ID
 */
export async function getCampById(id: string): Promise<Camp | null> {
  const { data, error } = await supabase
    .from('camps')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching camp:', error)
    throw error
  }

  return data
}

/**
 * Search camps by name or description
 */
export async function searchCamps(query: string): Promise<Camp[]> {
  const { data, error } = await supabase
    .from('camps')
    .select('*')
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error searching camps:', error)
    throw error
  }

  return data || []
}


