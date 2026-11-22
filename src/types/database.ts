// Type definitions for your Supabase tables
// Update these based on your actual table schemas

/**
 * Trust state of a camp or session row. Set by migration 001.
 *
 *   unverified     no extraction has touched this row for its season_year
 *   auto           extracted and published without human review
 *   human_checked  a reviewer approved it
 *   camp_confirmed the camp itself confirmed it
 */
export type VerificationStatus =
  | 'unverified'
  | 'auto'
  | 'human_checked'
  | 'camp_confirmed'

export interface Camp {
  id: string
  name: string
  description?: string
  location?: string
  website_url?: string
  image_url?: string
  // Age range is not stored on camps — it is derived from the camp's sessions
  // (see CampSession.min_age/max_age). day_type is a label like "Full day" /
  // "Half day"; zipcode_id is a nullable FK to the zipcodes table.
  day_type?: string | null
  zipcode_id?: string | null
  latitude?: number | null
  longitude?: number | null
  created_at?: string
  updated_at?: string
  // Provenance of the camp record itself (name, location, website). Session
  // dates/price/ages carry their own trust fields on CampSession.
  // `source_url` is the page the data was extracted from — not website_url,
  // which is the homepage shown to parents.
  source_url?: string | null
  season_year?: number | null
  last_verified_at?: string | null
  verification_status?: VerificationStatus
}

export interface CampSession {
  id: string
  camp_id: string
  name?: string
  label?: string
  start_date?: string
  end_date?: string
  start_time?: string | null
  end_time?: string | null
  days_of_week?: string[]
  price?: number
  min_age?: number
  max_age?: number
  capacity?: number
  created_at?: string
  updated_at?: string
  // Per-session provenance: one week can be confirmed while another is a guess.
  source_url?: string | null
  last_verified_at?: string | null
  verification_status?: VerificationStatus
  // 0..1. NULL means never scored — NOT zero confidence.
  confidence_dates?: number | null
  confidence_price?: number | null
  confidence_ages?: number | null
  // Generated from start_date in Postgres. Never write to it.
  season_year?: number | null
}

export interface CampInterest {
  id: string
  camp_id: string
  tag?: string
  interest_name?: string
  created_at?: string
}

export interface EmailSignup {
  id: string
  email: string
  source?: string | null
  created_at?: string
}

/** A page we extract camp data from. Service-role only — RLS on, no policies. */
export interface CampSource {
  id: string
  camp_id: string
  url: string
  url_type:
    | 'homepage'
    | 'schedule'
    | 'pricing'
    | 'registration'
    | 'pdf'
    | 'portal'
    | 'sitemap'
    | 'other'
  content_hash?: string | null
  last_fetched_at?: string | null
  /** HTTP status of the last fetch. */
  last_status?: number | null
  /**
   * What the fetch was worth to us, which a status code cannot say: a 200 that
   * turns out to be a JavaScript-only registration portal is `needs_js`.
   */
  last_outcome?:
    | 'ok'
    | 'unchanged'
    | 'not_found'
    | 'blocked'
    | 'needs_js'
    | 'parse_failed'
    | 'error'
    | null
  last_error?: string | null
  /** For conditional GETs — content_hash saves the parse, these save the download. */
  etag?: string | null
  last_modified?: string | null
  /** 1 = highest, 9 = lowest. */
  fetch_priority?: number
  notes?: string | null
  created_at?: string
  updated_at?: string
}

/**
 * A staged change waiting for review. Nothing here is visible to parents until
 * `apply_camp_update()` publishes it. Service-role only.
 */
export interface CampUpdate {
  id: string
  camp_id: string
  source_id?: string | null
  target_table: 'camps' | 'camp_sessions'
  /** NULL for a proposed insert; set to the new row's id once applied. */
  target_id?: string | null
  change_type: 'insert' | 'update' | 'delete'
  season_year?: number | null
  /** Only the fields that changed, as { column: newValue }. Reviewed as a diff. */
  proposed: Record<string, unknown>
  /**
   * The same fields as they were at extraction time. Compared against the live
   * row on apply; a mismatch marks the proposal `superseded` rather than
   * clobbering someone's hand edit.
   */
  current_values?: Record<string, unknown> | null
  confidence?: number | null
  /** Output of src/lib/validation/campData.ts — see toValidationJson(). */
  validation?: {
    ok: boolean
    issues: Array<{
      field: string
      rule: string
      severity: 'error' | 'warning'
      message: string
    }>
  } | null
  status: 'pending' | 'needs_review' | 'approved' | 'rejected' | 'applied' | 'superseded'
  content_hash?: string | null
  extractor?: string | null
  extracted_at?: string
  reviewed_at?: string | null
  reviewed_by?: string | null
  review_note?: string | null
  applied_at?: string | null
  /** Set when the camp sent this through its update form (migration 008). */
  submission_id?: string | null
}

/**
 * One camp's own update, sent through /camps/[id]/update (migration 008). Each
 * session in it is a camp_updates proposal pointing back here. Personal data:
 * service role only.
 */
export interface CampSubmission {
  id: string
  camp_id: string
  contact_name: string
  contact_email: string
  contact_role?: string | null
  message?: string | null
  season_year: number
  session_count: number
  /** sha256 of the sender's IP, only to rate-limit the form. */
  ip_hash?: string | null
  created_at: string
}

/**
 * Read-only rollup view (migration 001). Session columns are the WORST across
 * the camp's in-season sessions — a badge must not average away the one week
 * whose price is a guess.
 */
export interface CampTrust {
  camp_id: string
  camp_verification_status: VerificationStatus
  camp_last_verified_at: string | null
  season_year: number | null
  source_url: string | null
  weakest_session_status: VerificationStatus | null
  oldest_session_verified_at: string | null
  worst_dates_confidence: number | null
  worst_price_confidence: number | null
  worst_ages_confidence: number | null
  sessions_in_season: number
  sessions_total: number
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
        // season_year is GENERATED ALWAYS in Postgres — writing to it errors.
        Insert: Omit<CampSession, 'id' | 'created_at' | 'updated_at' | 'season_year'>
        Update: Partial<Omit<CampSession, 'id' | 'created_at' | 'season_year'>>
      }
      camp_interests: {
        Row: CampInterest
        Insert: Omit<CampInterest, 'id' | 'created_at'>
        Update: Partial<Omit<CampInterest, 'id' | 'created_at'>>
      }
      email_signups: {
        Row: EmailSignup
        Insert: Omit<EmailSignup, 'id' | 'created_at'>
        Update: Partial<Omit<EmailSignup, 'id' | 'created_at'>>
      }
      camp_sources: {
        Row: CampSource
        Insert: Omit<CampSource, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CampSource, 'id' | 'created_at'>>
      }
      camp_updates: {
        Row: CampUpdate
        Insert: Omit<CampUpdate, 'id' | 'extracted_at'>
        Update: Partial<Omit<CampUpdate, 'id' | 'extracted_at'>>
      }
      camp_submissions: {
        Row: CampSubmission
        Insert: Omit<CampSubmission, 'id' | 'created_at'>
        Update: Partial<Omit<CampSubmission, 'id' | 'created_at'>>
      }
    }
    Views: {
      camp_trust: {
        Row: CampTrust
      }
    }
    Functions: {
      // Publishes one approved camp_updates row, atomically.
      apply_camp_update: {
        Args: { update_id: string }
        Returns: 'applied' | 'superseded'
      }
    }
  }
}


