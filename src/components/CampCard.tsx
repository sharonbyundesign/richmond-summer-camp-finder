'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
  const [images, setImages] = useState<string[]>([]);
  const [imageIndex, setImageIndex] = useState(0);

  // Check if camp is saved on mount
  useEffect(() => {
    const savedCamps = JSON.parse(localStorage.getItem('savedCamps') || '[]');
    setIsSaved(savedCamps.includes(camp.id));
  }, [camp.id]);

  useEffect(() => {
    let cancelled = false;

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
      if (!camp.website_url) {
        setImages([]);
        return;
      }

      const cached = loadCache();
      if (cached) {
        setImages(cached);
        return;
      }

      try {
        const response = await fetch(`/api/camps/${camp.id}/images`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && Array.isArray(data.images)) {
          setImages(data.images);
          saveCache(data.images);
        }
      } catch {
        // Ignore image scraping errors
      }
    };

    fetchImages();

    return () => {
      cancelled = true;
    };
  }, [camp.id, camp.website_url]);

  const currentImage = images[imageIndex];
  const hasCarousel = images.length > 1;
  const totalDots = useMemo(() => Math.min(images.length, 5), [images.length]);

  const handlePrev = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNext = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setImageIndex((prev) => (prev + 1) % images.length);
  };

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
      {/* Image Carousel / Placeholder */}
      <div className="w-full h-48 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 relative overflow-hidden">
        {currentImage ? (
          <Image
            src={currentImage}
            alt={`${camp.name} photo`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover"
            onError={() => {
              setImages((prev) => prev.filter((img) => img !== currentImage));
              setImageIndex(0);
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-24 h-24 text-white opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
        )}

        {hasCarousel && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-gray-700 z-10"
              aria-label="Previous image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-gray-700 z-10"
              aria-label="Next image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {images.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5 z-10">
            {Array.from({ length: totalDots }).map((_, idx) => {
              const isActive = idx === imageIndex % totalDots;
              return (
                <span
                  key={`dot-${idx}`}
                  className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-white/60'}`}
                />
              );
            })}
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

        {camp.camp_interests && camp.camp_interests.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {camp.camp_interests.map((interest, idx) => (
              <span
                key={interest.id || idx}
                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
              >
                {interest.tag || interest.interest_name}
              </span>
            ))}
          </div>
        )}

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


