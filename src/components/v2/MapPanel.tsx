'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { METERS_PER_MILE, type LatLng } from '@/lib/v2/geo';
import { campInterestImageUrl } from '@/lib/campInterestImage';
import type { Camp, CampMarker } from '@/types/camp';

const DEFAULT_CENTER: [number, number] = [37.5407, -77.436];
const DEFAULT_ZOOM = 11;
const ACCENT = '#2563eb';

export interface MapMarker extends CampMarker {
  /** Outside the active radius: still shown, but visually demoted. */
  muted?: boolean;
  distanceMiles?: number | null;
}

const PIN_BASE = '#2563eb';
/** Hovered pin. Amber, not ACCENT — the base pins and radius circle already own that blue. */
const PIN_HIGHLIGHT = '#f2a918';
const HIGHLIGHT_SCALE = 1.4;
const PIN_W = 24;
const PIN_H = 34;

/**
 * Every marker below supplies its own divIcon, but Leaflet still builds its default
 * icon internally. Left unconfigured it resolves bare filenames against the site root
 * and 404s, so point it at the copies in public/leaflet.
 */
if ('_getIconUrl' in L.Icon.Default.prototype) {
  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
}
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

/**
 * Teardrop pins are drawn as divIcons rather than Leaflet's default image icon so a
 * hovered pin can change colour and scale without swapping assets.
 */
function makePinIcon(color: string, scale: number) {
  const width = PIN_W * scale;
  const height = PIN_H * scale;

  return L.divIcon({
    className: '',
    html:
      `<svg width="${width}" height="${height}" viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg" ` +
      `style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">` +
      `<path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 22 12 22s12-13.6 12-22c0-6.6-5.4-12-12-12z" ` +
      `fill="${color}" stroke="#ffffff" stroke-width="2"/>` +
      `<circle cx="12" cy="12" r="4.2" fill="#ffffff"/>` +
      `</svg>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 6],
  });
}

const baseIcon = makePinIcon(PIN_BASE, 1);
const highlightIcon = makePinIcon(PIN_HIGHLIGHT, HIGHLIGHT_SCALE);

/** Small grey dot for camps outside the radius — present, but clearly not a result. */
const mutedIcon = L.divIcon({
  className: '',
  html: '<span style="display:block;width:10px;height:10px;border-radius:9999px;background:#9ca3af;box-shadow:0 0 0 2px rgba(255,255,255,.8)"></span>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

/**
 * Leaflet caches its container size at init. A sticky panel sized by the grid — and a
 * mobile panel that mounts hidden — both leave it stale, so watch the element.
 */
function ResizeWatcher() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    map.invalidateSize();
    return () => observer.disconnect();
  }, [map]);

  return null;
}

/** Frames the radius circle when a zip is set, otherwise the visible pins. */
function FitView({
  markers,
  center,
  radiusMiles,
}: {
  markers: MapMarker[];
  center: LatLng | null;
  radiusMiles: number;
}) {
  const map = useMap();

  const active = markers.filter((marker) => !marker.muted);
  const fingerprint = useMemo(
    () =>
      [
        center ? `${center.lat},${center.lng},${radiusMiles}` : 'nozip',
        active
          .map((marker) => marker.id)
          .sort()
          .join(','),
      ].join('|'),
    [center, radiusMiles, active]
  );

  useEffect(() => {
    if (center) {
      map.fitBounds(L.latLng(center.lat, center.lng).toBounds(radiusMiles * METERS_PER_MILE * 2), {
        padding: [32, 32],
      });
      return;
    }

    if (active.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    map.fitBounds(
      L.latLngBounds(active.map((marker) => [marker.lat, marker.lng] as [number, number])),
      { padding: [48, 48], maxZoom: 14 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, map]);

  return null;
}

function PopupCard({ camp, distanceMiles }: { camp: Camp; distanceMiles?: number | null }) {
  const map = useMap();

  // Same photo the list card shows: interest pool / hand-picked override, then the
  // camp's own image_url. Falls back to the placeholder icon if both are absent or 404.
  const [image, setImage] = useState<string | null>(
    () => campInterestImageUrl(camp.id, camp.camp_interests) ?? camp.image_url ?? null
  );

  const sessions = camp.camp_sessions || [];
  const starts = sessions.map((s) => new Date(s.start_date).getTime()).filter((t) => !Number.isNaN(t));
  const ends = sessions.map((s) => new Date(s.end_date).getTime()).filter((t) => !Number.isNaN(t));

  const formatDate = (time: number) =>
    new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="relative w-64">
      <button
        type="button"
        onClick={() => map.closePopup()}
        className="absolute -top-3 -right-3 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md transition-colors hover:text-gray-700"
        aria-label="Close"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <Link
        href={`/camps/${camp.id}`}
        className="block overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md"
      >
        <div className="relative h-24 w-full bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600">
          {image ? (
            // Plain <img>: Leaflet renders the popup outside Next's layout tree, so
            // next/image's fill sizing doesn't apply cleanly here.
            <img
              src={image}
              alt={`${camp.name} photo`}
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setImage(null)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="h-10 w-10 text-white opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="p-2">
          <h4 className="line-clamp-2 text-sm font-semibold text-gray-900">{camp.name}</h4>

          {typeof distanceMiles === 'number' && (
            <p className="mt-1 text-xs font-semibold text-blue-700">{distanceMiles.toFixed(1)} mi away</p>
          )}

          {camp.location && <p className="mt-1 line-clamp-1 text-xs text-gray-600">{camp.location}</p>}
          {camp.description && <p className="mt-2 line-clamp-2 text-xs text-gray-600">{camp.description}</p>}

          {sessions.length > 0 && (
            <div className="mt-3 border-t border-gray-200 pt-3 text-xs text-gray-600">
              <p className="font-medium text-gray-900">
                {sessions.length} session{sessions.length === 1 ? '' : 's'}
              </p>
              {starts.length > 0 && ends.length > 0 && (
                <p className="mt-1">
                  {formatDate(Math.min(...starts))} – {formatDate(Math.max(...ends))}
                </p>
              )}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

interface MapPanelProps {
  markers: MapMarker[];
  center: LatLng | null;
  radiusMiles: number;
  caption: string;
  /** Camp whose card is hovered in the list. Its pin grows and turns amber. */
  highlightedId?: string | null;
  /** Camp whose pin was clicked. Stays lit until another pin is clicked or its popup closes. */
  selectedId?: string | null;
  onSelect?: (campId: string | null) => void;
}

export default function MapPanel({
  markers,
  center,
  radiusMiles,
  caption,
  highlightedId,
  selectedId,
  onSelect,
}: MapPanelProps) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-100 md:rounded-2xl md:border md:border-gray-200">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <ResizeWatcher />
        <FitView markers={markers} center={center} radiusMiles={radiusMiles} />

        {center && (
          <>
            <Circle
              center={[center.lat, center.lng]}
              radius={radiusMiles * METERS_PER_MILE}
              pathOptions={{
                color: ACCENT,
                weight: 2,
                dashArray: '6 6',
                fillColor: ACCENT,
                fillOpacity: 0.07,
              }}
            />
            <CircleMarker
              center={[center.lat, center.lng]}
              radius={5}
              pathOptions={{ color: '#ffffff', weight: 2, fillColor: ACCENT, fillOpacity: 1 }}
            />
          </>
        )}

        {markers.map((marker) => {
          // Hovering its card and clicking the pin itself both light a pin up.
          const active = marker.id === highlightedId || marker.id === selectedId;

          return (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={marker.muted ? mutedIcon : active ? highlightIcon : baseIcon}
              zIndexOffset={active ? 1000 : marker.muted ? -500 : 0}
              opacity={marker.muted ? 0.75 : 1}
              eventHandlers={{
                click: () => onSelect?.(marker.id),
                popupclose: () => onSelect?.(null),
              }}
            >
              <Popup closeButton={false} className="camp-popup">
                <PopupCard camp={marker.camp} distanceMiles={marker.distanceMiles} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-200">
        {caption}
      </div>
    </div>
  );
}
