// Approximate centroids for Richmond-metro ZIP codes.
//
// There is no zipcodes table in Supabase, so the distance filter resolves an
// entered ZIP to a centroid here and measures straight-line (haversine) miles
// to each camp's own latitude/longitude. Coordinates are approximate centroids
// — fine for a "within N miles" radius filter, not for turn-by-turn accuracy.
// An unrecognized ZIP means the distance filter is treated as inactive.

import type { LatLng } from '@/lib/campFilters';

const RICHMOND_ZIP_CENTROIDS: Record<string, LatLng> = {
  // City of Richmond
  '23219': { lat: 37.541, lng: -77.435 },
  '23220': { lat: 37.553, lng: -77.457 },
  '23221': { lat: 37.556, lng: -77.487 },
  '23222': { lat: 37.578, lng: -77.425 },
  '23223': { lat: 37.531, lng: -77.400 },
  '23224': { lat: 37.503, lng: -77.470 },
  '23225': { lat: 37.518, lng: -77.507 },
  '23226': { lat: 37.585, lng: -77.512 },
  '23227': { lat: 37.617, lng: -77.437 },
  '23228': { lat: 37.633, lng: -77.492 },
  '23229': { lat: 37.594, lng: -77.560 },
  '23230': { lat: 37.588, lng: -77.485 },
  '23231': { lat: 37.470, lng: -77.320 },
  '23234': { lat: 37.458, lng: -77.470 },
  '23235': { lat: 37.535, lng: -77.560 },
  '23236': { lat: 37.505, lng: -77.590 },
  '23237': { lat: 37.417, lng: -77.470 },
  '23294': { lat: 37.630, lng: -77.540 },
  // Henrico County
  '23059': { lat: 37.690, lng: -77.560 },
  '23060': { lat: 37.650, lng: -77.520 },
  '23075': { lat: 37.548, lng: -77.320 },
  '23150': { lat: 37.510, lng: -77.290 },
  '23233': { lat: 37.657, lng: -77.610 },
  '23238': { lat: 37.630, lng: -77.640 },
  '23250': { lat: 37.510, lng: -77.330 },
  // Chesterfield County / Midlothian
  '23112': { lat: 37.420, lng: -77.640 },
  '23113': { lat: 37.510, lng: -77.650 },
  '23114': { lat: 37.470, lng: -77.600 },
  '23120': { lat: 37.410, lng: -77.740 },
  '23803': { lat: 37.210, lng: -77.450 },
  '23831': { lat: 37.360, lng: -77.440 },
  '23832': { lat: 37.380, lng: -77.600 },
  '23834': { lat: 37.270, lng: -77.400 },
  '23836': { lat: 37.330, lng: -77.350 },
  // Hanover County / Ashland / Mechanicsville
  '23005': { lat: 37.760, lng: -77.480 },
  '23069': { lat: 37.770, lng: -77.360 },
  '23111': { lat: 37.610, lng: -77.360 },
  '23116': { lat: 37.660, lng: -77.320 },
  // Outer metro
  '23063': { lat: 37.690, lng: -77.880 },
  '23139': { lat: 37.560, lng: -77.900 },
  '23838': { lat: 37.320, lng: -77.630 },
  '23860': { lat: 37.300, lng: -77.290 },
};

export function zipToLatLng(zip: string): LatLng | null {
  const normalized = (zip || '').trim().slice(0, 5);
  return RICHMOND_ZIP_CENTROIDS[normalized] ?? null;
}
