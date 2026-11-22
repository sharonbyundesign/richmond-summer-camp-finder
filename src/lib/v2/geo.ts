import zipTable from '@/data/richmond-zips.json';
import campCoordTable from '@/data/camp-coords.json';
import type { Camp, CampMarker } from '@/types/camp';
import { campPoints, visibleLocations, type CampLocation } from '@/lib/locations';
import { cityFromLocation } from '@/lib/campCardFormat';

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

/**
 * Every point this camp can be pinned at: its in-area sites (migration 007),
 * else its own coordinates, else the offline lookup. One entry for almost
 * every camp; several for YMCA, ACAC and the like.
 */
export function campSites(camp: Camp): LatLng[] {
  const points = campPoints(camp);
  if (points.length > 0) return points;
  const single = campCoord(camp);
  return single ? [single] : [];
}

/** How a site is named to a parent: its own name, else the city in its address. */
export function siteLabel(location: CampLocation): string | null {
  return location.name ?? cityFromLocation(location.address) ?? null;
}

/**
 * The site closest to `origin`, and how far. With no origin, the first site
 * stands in, with no distance — the card then says "N locations".
 */
export function nearestSite(
  camp: Camp,
  origin: LatLng | null,
): { coords: LatLng | null; distance: number | null; label: string | null; siteCount: number } {
  const sites = visibleLocations(camp);
  const pinned = sites.filter((l) => l.latitude != null && l.longitude != null);
  const siteCount = sites.length;

  if (pinned.length === 0) {
    const coords = campSites(camp)[0] ?? null;
    return {
      coords,
      distance: coords && origin ? haversineMiles(origin, coords) : null,
      label: sites[0] ? siteLabel(sites[0]) : null,
      siteCount,
    };
  }

  let best = pinned[0];
  let bestDistance: number | null = null;
  if (origin) {
    for (const site of pinned) {
      const d = haversineMiles(origin, { lat: site.latitude as number, lng: site.longitude as number });
      if (bestDistance === null || d < bestDistance) {
        best = site;
        bestDistance = d;
      }
    }
  }

  return {
    coords: { lat: best.latitude as number, lng: best.longitude as number },
    distance: bestDistance,
    label: siteLabel(best),
    siteCount,
  };
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
