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
  zipcode_id?: number;
  zipcode?: CampZipcode | null;
  camp_sessions?: CampSession[];
  camp_interests?: CampInterest[];
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
