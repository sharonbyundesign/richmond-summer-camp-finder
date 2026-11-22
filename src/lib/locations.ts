/**
 * Camp locations (migration 007): where each session runs.
 *
 * A camp can run at several sites — YMCA branches, ACAC clubs, James River
 * Association's programs in Richmond, Lynchburg and on the river itself.
 * Sessions point at the site they run at; a session with no location_id falls
 * back to the camp's own address, which is how every camp behaved before.
 */

export interface CampLocation {
  id: string;
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  outside_service_area: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
}

interface SessionWithLocation {
  location_id?: string | null;
}

interface CampWithLocations<S extends SessionWithLocation = SessionWithLocation> {
  latitude?: number | null;
  longitude?: number | null;
  camp_sessions?: S[] | null;
  camp_locations?: CampLocation[] | null;
}

/**
 * Remove what is outside the Richmond area before anything else sees the camp.
 *
 * Those sessions are true — James River Association really does run a camp in
 * Lynchburg — but a Richmond parent cannot use them, and listing them is how
 * a Lynchburg week ended up looking like a Richmond one. Done once, in the
 * API, so the filters, the card, the map and the detail page cannot disagree
 * about which sessions exist.
 *
 * A camp whose every session is out of area keeps no sessions, which the page
 * already treats honestly as "no dates for this camp yet".
 */
export function applyServiceArea<C extends CampWithLocations>(camp: C): C {
  const locations = camp.camp_locations ?? null;
  if (!locations || locations.length === 0) return camp;

  const outside = new Set(locations.filter((l) => l.outside_service_area).map((l) => l.id));
  if (outside.size === 0) return camp;

  return {
    ...camp,
    camp_locations: locations.filter((l) => !outside.has(l.id)),
    camp_sessions: (camp.camp_sessions ?? []).filter((s) => !s.location_id || !outside.has(s.location_id)),
  };
}

/**
 * Every place this camp can be pinned and measured from: its in-area sites
 * that have coordinates, or — before migration 007, or for a camp with no
 * sites entered — the camp's own coordinates.
 */
export function campPoints(camp: CampWithLocations): LatLng[] {
  const sites = (camp.camp_locations ?? [])
    .filter((l) => !l.outside_service_area && l.latitude != null && l.longitude != null)
    .map((l) => ({ lat: l.latitude as number, lng: l.longitude as number }));

  if (sites.length > 0) return sites;
  if (camp.latitude != null && camp.longitude != null) return [{ lat: camp.latitude, lng: camp.longitude }];
  return [];
}

/** Sites a parent can be shown: in area, whether or not they can be pinned. */
export function visibleLocations(camp: CampWithLocations): CampLocation[] {
  return (camp.camp_locations ?? []).filter((l) => !l.outside_service_area);
}

/** The site a session runs at, if one is recorded and in area. */
export function sessionLocation(camp: CampWithLocations, session: SessionWithLocation): CampLocation | null {
  if (!session.location_id) return null;
  return visibleLocations(camp).find((l) => l.id === session.location_id) ?? null;
}
