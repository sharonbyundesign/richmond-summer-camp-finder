// Type definitions for your Supabase tables
// Update these based on your actual table schemas

export interface Camp {
  id: string
  name: string
  description?: string
  location?: string
  min_age?: number
  max_age?: number
  website_url?: string
  created_at?: string
  updated_at?: string
}

export interface CampSession {
  id: string
  camp_id: string
  name?: string
  label?: string
  start_date?: string
  end_date?: string
  price?: number
  capacity?: number
  created_at?: string
  updated_at?: string
}

export interface CampInterest {
  id: string
  camp_id: string
  tag?: string
  interest_name?: string
  created_at?: string
}

// Database type for Supabase
export type Database = {
  public: {
    Tables: {
      camps: {
        Row: Camp
        Insert: Omit<Camp, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Camp, 'id' | 'created_at'>>
      }
      camp_sessions: {
        Row: CampSession
        Insert: Omit<CampSession, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CampSession, 'id' | 'created_at'>>
      }
      camp_interests: {
        Row: CampInterest
        Insert: Omit<CampInterest, 'id' | 'created_at'>
        Update: Partial<Omit<CampInterest, 'id' | 'created_at'>>
      }
    }
  }
}


