'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import GoogleReviewsLink from '@/components/GoogleReviewsLink';
import { capture } from '@/lib/analytics';
import { cityFromLocation, ageRange, sessionRange } from '@/lib/campCardFormat';

interface CampCardProps {
  /** Straight-line miles from the searched zip. Omitted in v1, which has no zip search. */
  distanceMiles?: number | null;
  /** Supplied by v2 to sync card hover with the map pin. Its presence also enables the lift. */
  onHoverChange?: (hovered: boolean) => void;
  camp: {
    id: string;
    name: string;
    location?: string;
    description?: string;
    website_url?: string;
    image_url?: string | null;
    /** Not in the camps table yet; the reviews link falls back to a Maps search until it is. */
    place_id?: string | null;
    zipcode_id?: number;
    camp_sessions?: Array<{
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
    }>;
    camp_interests?: Array<{
      id?: string;
      tag?: string;
      interest_name?: string;
    }>;
  };
}

const MAX_TAGS = 2;

export default function CampCard({ camp, distanceMiles, onHoverChange }: CampCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [image, setImage] = useState<string | null>(camp.image_url ?? null);

  useEffect(() => {
    const savedCamps = JSON.parse(localStorage.getItem('savedCamps') || '[]');
    setIsSaved(savedCamps.includes(camp.id));
  }, [camp.id]);

  // Nearly every camp now has an image_url; only fall back to scraping the camp's own
  // site for the few that don't.
  useEffect(() => {
    if (camp.image_url) {
      setImage(camp.image_url);
      return;
    }
    if (!camp.website_url) return;

    let cancelled = false;
    const cacheKey = `campImages:v2:${camp.id}`;

    const run = async () => {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (Array.isArray(cached) && cached[0]) {
          setImage(cached[0]);
          return;
        }

        const response = await fetch(`/api/camps/${camp.id}/images`);
        if (!response.ok) return;

        const data = await response.json();
        if (cancelled || !Array.isArray(data.images) || !data.images[0]) return;

        setImage(data.images[0]);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data.images));
        } catch {
          // Ignore quota failures
        }
      } catch {
        // Ignore scraping errors — the placeholder is a fine fallback
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [camp.id, camp.website_url, camp.image_url]);

  const handleSaveToggle = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const savedCamps: string[] = JSON.parse(localStorage.getItem('savedCamps') || '[]');
    const next = isSaved ? savedCamps.filter((id) => id !== camp.id) : [...savedCamps, camp.id];

    setIsSaved(!isSaved);
    capture(isSaved ? 'camp_unsaved' : 'camp_saved', { camp_id: camp.id });

    try {
      await fetch(`/api/camps/${camp.id}/save`, { method: isSaved ? 'DELETE' : 'POST' });
    } catch (err) {
      console.error('Error updating saved camp:', err);
    }

    localStorage.setItem('savedCamps', JSON.stringify(next));
    window.dispatchEvent(new Event('savedCampsUpdated'));
  };

  const tags = (camp.camp_interests || [])
    .map((interest) => interest.tag || interest.interest_name)
    .filter((tag): tag is string => Boolean(tag));

  const city = cityFromLocation(camp.location);
  const ages = ageRange(camp.camp_sessions);
  const dates = sessionRange(camp.camp_sessions);
  const sessionCount = camp.camp_sessions?.length ?? 0;

  const metaParts = [city, ages].filter(Boolean);

  return (
    <Link
      href={`/camps/${camp.id}`}
      onClick={() => capture('card_clicked', { camp_id: camp.id })}
      onMouseEnter={onHoverChange ? () => onHoverChange(true) : undefined}
      onMouseLeave={onHoverChange ? () => onHoverChange(false) : undefined}
      className={`flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${
        onHoverChange
          ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-xl'
          : 'transition-shadow hover:shadow-lg'
      }`}
    >
      {/* Photo, with the interest tag and save control floating over it */}
      <div className="relative h-44 w-full flex-shrink-0 bg-gray-100">
        {image ? (
          <Image
            src={image}
            alt={`${camp.name} photo`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover"
            onError={() => setImage(null)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {tags.length > 0 && (
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {tags.slice(0, MAX_TAGS).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-gray-800 shadow-sm"
              >
                {tag}
              </span>
            ))}
            {tags.length > MAX_TAGS && (
              <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm">
                +{tags.length - MAX_TAGS}
              </span>
            )}
          </div>
        )}

        <button
          onClick={handleSaveToggle}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-gray-50"
          aria-label={isSaved ? 'Unsave camp' : 'Save camp'}
        >
          {isSaved ? (
            <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          )}
        </button>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold leading-snug text-gray-900">{camp.name}</h3>

        {(metaParts.length > 0 || typeof distanceMiles === 'number') && (
          <p className="mt-1 text-sm text-gray-500">
            {metaParts.join(' · ')}
            {typeof distanceMiles === 'number' && (
              <>
                {metaParts.length > 0 && ' · '}
                <span className="font-medium text-blue-600">{distanceMiles.toFixed(1)} mi</span>
              </>
            )}
          </p>
        )}

        {camp.description && (
          <p className="mt-2 line-clamp-2 text-sm text-gray-600">{camp.description}</p>
        )}

        {sessionCount > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-600">
            <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>
              {sessionCount} session{sessionCount === 1 ? '' : 's'}
              {dates && ` · ${dates}`}
            </span>
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
          {camp.website_url ? (
            <a
              href={camp.website_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                event.stopPropagation();
                capture('registration_click', { camp_id: camp.id, url: camp.website_url });
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
            >
              Visit website
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          ) : (
            <span />
          )}

          <GoogleReviewsLink camp={camp} />
        </div>
      </div>
    </Link>
  );
}
