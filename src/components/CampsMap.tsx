'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type CampMapItem = {
  id: string;
  name: string;
  location?: string;
  description?: string;
  website_url?: string;
  zipcode?: {
    id?: number;
    zip_code?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  camp_sessions?: Array<{
    id?: string;
    name?: string;
    label?: string;
    start_date: string;
    end_date: string;
  }>;
  camp_interests?: Array<{
    id?: string;
    tag?: string;
    interest_name?: string;
  }>;
};

interface CampsMapProps {
  camps: CampMapItem[];
}

const DEFAULT_CENTER = { lat: 37.5407, lng: -77.4360 };
const DEFAULT_ZOOM = 11;
const GEO_CACHE_KEY = 'campGeoCache';
const GEO_DELAY_MS = 1100;

type MarkerData = {
  id: string;
  name: string;
  location?: string;
  lat: number;
  lng: number;
  zip?: string;
  camp: CampMapItem;
};

// Fix default marker icons in Leaflet for bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function CampsMap({ camps }: CampsMapProps) {
  const [resolvedMarkers, setResolvedMarkers] = useState<MarkerData[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCache = (): Record<string, { lat: number; lng: number }> => {
      try {
        const raw = localStorage.getItem(GEO_CACHE_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
      } catch {
        return {};
      }
    };

    const saveCache = (cache: Record<string, { lat: number; lng: number }>) => {
      try {
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
      } catch {
        // Ignore cache failures
      }
    };

    const delay = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    const geocodeAddress = async (query: string) => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
      });
      if (!response.ok) return null;
      const data = (await response.json()) as Array<{ lat: string; lon: string }>;
      if (!data || data.length === 0) return null;
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return { lat, lng };
    };

    const bootstrap = async () => {
      const cache = loadCache();

      const initialMarkers = camps
        .map((camp) => {
          const lat = camp.zipcode?.latitude;
          const lng = camp.zipcode?.longitude;
          if (typeof lat === 'number' && typeof lng === 'number') {
            return {
              id: camp.id,
              name: camp.name,
              location: camp.location,
              lat,
              lng,
              zip: camp.zipcode?.zip_code || undefined,
              camp,
            };
          }

          const cached = cache[camp.id];
          if (cached) {
            return {
              id: camp.id,
              name: camp.name,
              location: camp.location,
              lat: cached.lat,
              lng: cached.lng,
              camp,
            };
          }

          return null;
        })
        .filter((marker): marker is MarkerData => marker !== null);

      if (!cancelled) {
        setResolvedMarkers(initialMarkers);
      }

      const pending = camps.filter((camp) => {
        const hasZipCoords =
          typeof camp.zipcode?.latitude === 'number' &&
          typeof camp.zipcode?.longitude === 'number';
        const hasCache = !!cache[camp.id];
        return !hasZipCoords && !hasCache && !!camp.location;
      });

      if (pending.length === 0) return;

      setIsGeocoding(true);

      for (const camp of pending) {
        if (cancelled) break;
        if (!camp.location) continue;

        try {
          const result = await geocodeAddress(camp.location);
          if (result) {
            cache[camp.id] = result;
            if (!cancelled) {
              setResolvedMarkers((prev) => {
                if (prev.some((marker) => marker.id === camp.id)) {
                  return prev;
                }
                return [
                  ...prev,
                  {
                    id: camp.id,
                    name: camp.name,
                    location: camp.location,
                    lat: result.lat,
                    lng: result.lng,
                    camp,
                  },
                ];
              });
            }
            saveCache(cache);
          }
        } catch {
          // Skip on geocode failures
        }

        await delay(GEO_DELAY_MS);
      }

      if (!cancelled) {
        setIsGeocoding(false);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [camps]);

  const center = useMemo(() => {
    if (resolvedMarkers.length === 0) return DEFAULT_CENTER;
    const sum = resolvedMarkers.reduce(
      (acc, marker) => {
        acc.lat += marker.lat;
        acc.lng += marker.lng;
        return acc;
      },
      { lat: 0, lng: 0 }
    );
    return {
      lat: sum.lat / resolvedMarkers.length,
      lng: sum.lng / resolvedMarkers.length,
    };
  }, [resolvedMarkers]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderSessionMeta = (camp: CampMapItem) => {
    const sessions = camp.camp_sessions || [];
    if (sessions.length === 0) return null;

    const allStartDates = sessions
      .map((s) => s.start_date)
      .filter((date): date is string => date != null)
      .map((date) => new Date(date).getTime())
      .filter((time) => !Number.isNaN(time));

    const allEndDates = sessions
      .map((s) => s.end_date)
      .filter((date): date is string => date != null)
      .map((date) => new Date(date).getTime())
      .filter((time) => !Number.isNaN(time));

    const earliestStart = allStartDates.length > 0 ? new Date(Math.min(...allStartDates)) : null;
    const latestEnd = allEndDates.length > 0 ? new Date(Math.max(...allEndDates)) : null;

    return (
      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
        <p className="font-medium text-gray-900">
          {sessions.length} session{sessions.length === 1 ? '' : 's'}
        </p>
        {earliestStart && latestEnd && (
          <p className="mt-1">
            {formatDate(earliestStart.toISOString().split('T')[0])} -{' '}
            {formatDate(latestEnd.toISOString().split('T')[0])}
          </p>
        )}
      </div>
    );
  };

  const PopupCard = ({ camp }: { camp: CampMapItem }) => {
    const map = useMap();

    return (
      <div className="relative w-64">
        <button
          type="button"
          onClick={() => map.closePopup()}
          className="absolute -top-3 -right-3 z-20 h-7 w-7 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <Link
          href={`/camps/${camp.id}`}
          className="block bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
        >
          <div className="w-full h-24 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-10 h-10 text-white opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <div className="p-2">
            <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">
              {camp.name}
            </h4>
            {camp.location && (
              <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                {camp.location}
              </p>
            )}
            {camp.description && (
              <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                {camp.description}
              </p>
            )}
            {renderSessionMeta(camp)}
          </div>
        </Link>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-gray-900">Map View</h3>
        <span className="text-xs text-gray-500">
          {resolvedMarkers.length} camp{resolvedMarkers.length === 1 ? '' : 's'} mapped
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Using camp addresses for map pins. {isGeocoding ? 'Finding locations…' : ' '}
      </p>
      <div className="h-[50vh] xl:h-[70vh] w-full rounded-md overflow-hidden border border-gray-200">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {resolvedMarkers.map((marker) => (
            <Marker key={marker.id} position={[marker.lat, marker.lng]}>
              <Popup closeButton={false} className="camp-popup">
                <PopupCard camp={marker.camp} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
