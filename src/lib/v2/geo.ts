import zipTable from '@/data/richmond-zips.json';
import campCoordTable from '@/data/camp-coords.json';
import type { Camp, CampMarker } from '@/types/camp';

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_MILES = 3958.8;
export const METERS_PER_MILE = 1609.34;

const ZIPS = zipTable as Record<string, LatLng>;
const CAMP_COORDS = campCoordTable as Record<string, { lat: number; lng: number; address: string }>;

/**
 * Nothing here touches the network: geocoding at runtime rate-limited badly and left
 * pins trickling in for minutes on a cold cache.
 */
export function lookupZip(zip: string): LatLng | null {
  return ZIPS[zip] ?? null;
}

/**
 * The camps table now carries lat/lng directly, which covers more camps and is more
 * authoritative than our offline pass. src/data/camp-coords.json remains as a fallback
 * for rows the database hasn't filled in yet.
 */
export function campCoord(camp: Camp): LatLng | null {
  if (typeof camp.latitude === 'number' && typeof camp.longitude === 'number') {
    return { lat: camp.latitude, lng: camp.longitude };
  }

  const entry = CAMP_COORDS[camp.id];
  return entry ? { lat: entry.lat, lng: entry.lng } : null;
}

export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/** Camps we could place. Camps with a vague address ("Multiple Richmond locations") are absent by design. */
export function buildMarkers(camps: Camp[]): CampMarker[] {
  return camps.flatMap((camp) => {
    const coords = campCoord(camp);
    if (!coords) return [];

    return [
      {
        id: camp.id,
        name: camp.name,
        location: camp.location,
        lat: coords.lat,
        lng: coords.lng,
        camp,
      },
    ];
  });
}
