import type { VerificationStatus } from '@/types/database';
import type { CampLocation } from '@/lib/locations';

export interface CampSession {
  id?: string;
  name?: string;
  label?: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  days_of_week?: string[];
  min_age?: number;
  max_age?: number;
  price?: number;
  capacity?: number;
  // Provenance (migration 001). Every one of these is optional on purpose:
  // the API omits them entirely until the migration is applied, and an absent
  // field is a different claim from an unverified one. See src/lib/trust.ts.
  source_url?: string | null;
  season_year?: number | null;
  last_verified_at?: string | null;
  /** When the row last changed; drives the "Recently updated" sort. */
  updated_at?: string | null;
  verification_status?: VerificationStatus;
  /** 0–1, or null when the field has never been scored. */
  confidence_dates?: number | null;
  confidence_price?: number | null;
  confidence_ages?: number | null;
  /** The site this session runs at (migration 007). Null when unknown. */
  location_id?: string | null;
}

export interface CampInterest {
  id?: string;
  tag?: string;
  interest_name?: string;
}

export interface CampZipcode {
  id?: number;
  zip_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Camp {
  id: string;
  name: string;
  location?: string;
  description?: string;
  website_url?: string;
  /** Hosted in Supabase Storage. Preferred over scraping the camp's website. */
  image_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  day_type?: string | null;
  zipcode_id?: number;
  zipcode?: CampZipcode | null;
  camp_sessions?: CampSession[];
  camp_interests?: CampInterest[];
  /** Every in-area site this camp runs at (migration 007). Absent before it. */
  camp_locations?: CampLocation[];
  /** Registration windows per summer (migration 010). Absent before it. */
  camp_registrations?: CampRegistration[];
  /** Provenance for the camp row itself; sessions carry their own. */
  source_url?: string | null;
  season_year?: number | null;
  last_verified_at?: string | null;
  /** When the row last changed; drives the "Recently updated" sort. */
  updated_at?: string | null;
  verification_status?: VerificationStatus;
}

/** When a summer's registration opens (migration 010). Dates are local Richmond time. */
export interface CampRegistration {
  season_year: number;
  opens_on?: string | null;
  opens_time?: string | null;
  priority_opens_on?: string | null;
  priority_opens_time?: string | null;
  priority_note?: string | null;
  opens_note?: string | null;
  registration_url?: string | null;
  status: 'unknown' | 'upcoming' | 'open' | 'waitlist' | 'full';
  fills_fast: boolean;
}

export interface CampMarker {
  id: string;
  name: string;
  location?: string;
  lat: number;
  lng: number;
  zip?: string;
  camp: Camp;
}
