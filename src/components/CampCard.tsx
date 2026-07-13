'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { categoryIcon, toCategories } from '@/lib/interest-categories';
import posthog from 'posthog-js';

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

export default function CampCard({ camp, distanceMiles, onHoverChange }: CampCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [images, setImages] = useState<string[]>(
    camp.image_url ? [camp.image_url] : []
  );

  // Check if camp is saved on mount
  useEffect(() => {
    const savedCamps = JSON.parse(localStorage.getItem('savedCamps') || '[]');
    setIsSaved(savedCamps.includes(camp.id));
  }, [camp.id]);

  useEffect(() => {
    let cancelled = false;

    // The curated image from the database is preferred; a scraped website
    // image is used only as a fallback when there is no curated one.
    const primary = camp.image_url ? [camp.image_url] : [];
    const mergeWithPrimary = (scraped: string[]) => {
      const seen = new Set<string>();
      return [...primary, ...scraped].filter((url) => {
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
      });
    };

    const cacheKey = `campImages:v2:${camp.id}`;
    const loadCache = () => {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    };

    const saveCache = (data: string[]) => {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {
        // Ignore cache failures
      }
    };

    const fetchImages = async () => {
      // Supabase now hosts a real photo for most camps. Only fall back to scraping the
      // camp's own website for the rows that don't have one yet.
      if (camp.image_url) {
        setImages([camp.image_url]);
        return;
      }

      if (!camp.website_url) {
        setImages(mergeWithPrimary([]));
        return;
      }

      const cached = loadCache();
      if (cached) {
        setImages(mergeWithPrimary(cached));
        return;
      }

      try {
        const response = await fetch(`/api/camps/${camp.id}/images`);
        if (!response.ok) {
          setImages(mergeWithPrimary([]));
          return;
        }
        const data = await response.json();
        if (!cancelled && Array.isArray(data.images)) {
          setImages(mergeWithPrimary(data.images));
          saveCache(data.images);
        }
      } catch {
        // Ignore image scraping errors — the curated image still shows.
      }
    };

    fetchImages();

    return () => {
      cancelled = true;
    };
  }, [camp.id, camp.website_url, camp.image_url]);

  const currentImage = images[0];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const savedCamps = JSON.parse(localStorage.getItem('savedCamps') || '[]');
    let newSavedCamps: string[];

    if (isSaved) {
      // Unsave
      newSavedCamps = savedCamps.filter((id: string) => id !== camp.id);
      setIsSaved(false);
      posthog.capture('camp_unsaved', { camp_id: camp.id, camp_name: camp.name });

      // Call API to unsave (for future database integration)
      try {
        await fetch(`/api/camps/${camp.id}/save`, { method: 'DELETE' });
      } catch (err) {
        console.error('Error unsaving camp:', err);
      }
    } else {
      // Save
      newSavedCamps = [...savedCamps, camp.id];
      setIsSaved(true);
      posthog.capture('camp_saved', { camp_id: camp.id, camp_name: camp.name });

      // Call API to save (for future database integration)
      try {
        await fetch(`/api/camps/${camp.id}/save`, { method: 'POST' });
      } catch (err) {
        console.error('Error saving camp:', err);
      }
    }

    localStorage.setItem('savedCamps', JSON.stringify(newSavedCamps));
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('savedCampsUpdated'));
  };


  return (
    <Link
      href={`/camps/${camp.id}`}
      onMouseEnter={onHoverChange ? () => onHoverChange(true) : undefined}
      onMouseLeave={onHoverChange ? () => onHoverChange(false) : undefined}
      className={`bg-white rounded-lg shadow-md border border-gray-200 flex flex-col h-full overflow-hidden block ${
        onHoverChange
          ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-xl'
          : 'hover:shadow-lg transition-shadow'
      }`}
    >
      {/* Image / Placeholder */}
      <div className="w-full h-48 bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-400 relative overflow-hidden">
        {currentImage ? (
          <Image
            src={currentImage}
            alt={`${camp.name} photo`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover"
            onError={() => {
              setImages((prev) => prev.filter((img) => img !== currentImage));
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-24 h-24 text-white opacity-70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/10 to-transparent"></div>

        {/* Save Button */}
        <button
          onClick={handleSaveToggle}
          className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-all z-10"
          aria-label={isSaved ? 'Unsave camp' : 'Save camp'}
          title={isSaved ? 'Unsave camp' : 'Save camp'}
        >
          {isSaved ? (
            <svg
              className="w-5 h-5 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
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
      
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-2 hover:text-blue-600 transition-colors">{camp.name}</h3>
        
        {camp.location && (
          <p className="text-gray-600 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {camp.location}
          </p>
        )}

        {typeof distanceMiles === 'number' && (
          <p className="mb-2 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            {distanceMiles.toFixed(1)} mi away
          </p>
        )}

        {distanceMiles === null && (
          <p className="mb-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            Distance unknown
          </p>
        )}

        {camp.camp_sessions && camp.camp_sessions.length > 0 && (() => {
          // Get age range from all sessions
          const allMinAges = camp.camp_sessions
            .map(s => s.min_age)
            .filter((age): age is number => age != null);
          const allMaxAges = camp.camp_sessions
            .map(s => s.max_age)
            .filter((age): age is number => age != null);
          
          const overallMinAge = allMinAges.length > 0 ? Math.min(...allMinAges) : null;
          const overallMaxAge = allMaxAges.length > 0 ? Math.max(...allMaxAges) : null;
          
          return (overallMinAge != null || overallMaxAge != null) ? (
            <p className="text-sm text-gray-500 mb-3">
              Ages {overallMinAge ?? '?'} - {overallMaxAge ?? '?'}
            </p>
          ) : null;
        })()}

        {camp.description && (
          <p className="text-gray-700 mb-4 line-clamp-3">{camp.description}</p>
        )}

        {camp.website_url && (
          <a
            href={camp.website_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:text-blue-800 hover:underline text-sm mb-4 inline-block break-all"
          >
            {camp.website_url.replace(/^https?:\/\//, '').replace(/^www\./, '')}
          </a>
        )}

        {(() => {
          const categories = toCategories(
            (camp.camp_interests || []).map((i) => i.tag || i.interest_name)
          );
          return categories.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((category) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                >
                  <span aria-hidden="true">{categoryIcon(category)}</span>
                  {category}
                </span>
              ))}
            </div>
          ) : null;
        })()}

        {camp.camp_sessions && camp.camp_sessions.length > 0 && (() => {
          // Calculate date range from all sessions
          const allStartDates = camp.camp_sessions
            .map(s => s.start_date)
            .filter((date): date is string => date != null)
            .map(date => new Date(date).getTime())
            .filter(time => !isNaN(time));
          
          const allEndDates = camp.camp_sessions
            .map(s => s.end_date)
            .filter((date): date is string => date != null)
            .map(date => new Date(date).getTime())
            .filter(time => !isNaN(time));
          
          const earliestStart = allStartDates.length > 0 ? new Date(Math.min(...allStartDates)) : null;
          const latestEnd = allEndDates.length > 0 ? new Date(Math.max(...allEndDates)) : null;
          
          return (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900">
                    {camp.camp_sessions.length} {camp.camp_sessions.length === 1 ? 'Session' : 'Sessions'}
                  </p>
                  {earliestStart && latestEnd && (
                    <p className="text-gray-600 mt-1">
                      {formatDate(earliestStart.toISOString().split('T')[0])} - {formatDate(latestEnd.toISOString().split('T')[0])}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        </div>
      </div>
    </Link>
  );
}


