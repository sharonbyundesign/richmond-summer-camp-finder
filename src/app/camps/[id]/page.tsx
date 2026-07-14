'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { categoryIcon, toCategories } from '@/lib/interest-categories';
import { campInterestImageUrl } from '@/lib/campInterestImage';
import GoogleReviewsLink from '@/components/GoogleReviewsLink';
import { capture } from '@/lib/analytics';
import { feedbackMailto } from '@/lib/contact';

interface CampSession {
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

interface CampInterest {
  id?: string;
  tag?: string;
  interest_name?: string;
}

interface Camp {
  id: string;
  name: string;
  location?: string;
  description?: string;
  website_url?: string;
  image_url?: string;
  /** Not in the camps table yet; the reviews link falls back to a Maps search until it is. */
  place_id?: string | null;
  zipcode_id?: number;
  camp_sessions?: CampSession[];
  camp_interests?: CampInterest[];
}

type SessionStatus = 'past' | 'in-progress' | 'upcoming';

/** Postgres `date` columns come back as YYYY-MM-DD (occasionally with a time suffix); only the date part matters. */
function dateOnly(value: string): string {
  return value.slice(0, 10);
}

/** Today's date in America/New_York as YYYY-MM-DD, so "past" doesn't depend on the viewer's local timezone. */
function todayInNewYork(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

function getSessionStatus(session: CampSession, todayNY: string): SessionStatus {
  if (dateOnly(session.end_date) < todayNY) return 'past';
  if (dateOnly(session.start_date) <= todayNY) return 'in-progress';
  return 'upcoming';
}

export default function CampDetailPage() {
  const params = useParams();
  const [camp, setCamp] = useState<Camp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedSessionIds, setSavedSessionIds] = useState<Set<string>>(new Set());

  // Load saved session IDs
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('savedSessions') || '[]');
    setSavedSessionIds(new Set(saved));
  }, []);

  // Listen for saved sessions updates
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = JSON.parse(localStorage.getItem('savedSessions') || '[]');
      setSavedSessionIds(new Set(saved));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('savedSessionsUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('savedSessionsUpdated', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const fetchCamp = async () => {
      try {
        const response = await fetch(`/api/camps/${params.id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Camp not found');
          } else {
            const errorData = await response.json().catch(() => ({}));
            setError(errorData.error || 'Unable to load camp details');
          }
          return;
        }

        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
        } else {
          setCamp(data.camp);
        }
      } catch (err) {
        console.error('Error fetching camp:', err);
        setError('Unable to connect to the server');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchCamp();
    }
  }, [params.id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const formatDaysOfWeek = (days?: string[]) => {
    if (!days || days.length === 0) return '';
    return days.join(', ');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded mb-6"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !camp) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Camps
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-800 mb-2">Error</h1>
            <p className="text-red-700">{error || 'Camp not found'}</p>
          </div>
        </div>
      </main>
    );
  }

  // Upcoming/in-progress sessions first (soonest start first); past sessions last (most recently ended first).
  const todayNY = todayInNewYork();
  const sortedSessions = [...(camp.camp_sessions || [])].sort((a, b) => {
    const aPast = getSessionStatus(a, todayNY) === 'past';
    const bPast = getSessionStatus(b, todayNY) === 'past';
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aPast
      ? dateOnly(b.end_date).localeCompare(dateOnly(a.end_date))
      : dateOnly(a.start_date).localeCompare(dateOnly(b.start_date));
  });

  const allSessionsPast =
    sortedSessions.length > 0 && sortedSessions.every((s) => getSessionStatus(s, todayNY) === 'past');
  const mostRecentSessionYear = allSessionsPast ? dateOnly(sortedSessions[0].end_date).slice(0, 4) : null;

  const reportUrl = feedbackMailto(`Incorrect info: ${camp.name}`);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6 sm:py-8">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Camps
        </Link>

        {/* Camp Header */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
          <div className="flex flex-col md:flex-row">
            {/* Camp Image (curated) or placeholder — same landscape ratio as the camp card, left side */}
            <div className="w-full md:w-80 lg:w-96 flex-shrink-0 aspect-video bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-400 relative overflow-hidden">
              {(campInterestImageUrl(camp.id, camp.camp_interests) ?? camp.image_url) ? (
                <Image
                  src={campInterestImageUrl(camp.id, camp.camp_interests) ?? camp.image_url!}
                  alt={`${camp.name} photo`}
                  fill
                  sizes="(max-width: 768px) 100vw, 384px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="w-32 h-32 text-white opacity-70"
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
            </div>

            {/* Camp Info — stacked, right side */}
            <div className="flex-1 p-6 flex flex-col">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{camp.name}</h1>

              {camp.location && (
                <p className="text-gray-600 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {camp.location}
                </p>
              )}

              {camp.description && (
                <p className="text-gray-700 mb-4 leading-relaxed">{camp.description}</p>
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
                        className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
                      >
                        <span aria-hidden="true">{categoryIcon(category)}</span>
                        {category}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}

              <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3">
                {camp.website_url && (
                  <a
                    href={camp.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => capture('camp_website_visited', { camp_id: camp.id, camp_name: camp.name })}
                    className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                  >
                    Visit Website
                  </a>
                )}

                {/* Secondary by design — it must not compete with the registration CTA. */}
                <GoogleReviewsLink camp={camp} />
              </div>
            </div>
          </div>
        </div>

        {/* Sessions Section */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Camp Sessions ({sortedSessions.length})
          </h2>

          {sortedSessions.length === 0 ? (
            <p className="text-gray-500">No sessions available for this camp.</p>
          ) : (
            <>
              {allSessionsPast && (
                <p className="mb-4 text-sm text-gray-600">
                  All {mostRecentSessionYear} sessions have ended.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
              {sortedSessions.map((session, idx) => {
                const isSaved = session.id ? savedSessionIds.has(session.id) : false;
                const status = getSessionStatus(session, todayNY);
                const isPast = status === 'past';
                const fieldTextClass = isPast ? 'text-gray-500' : 'text-gray-900';

                const handleSaveToggle = async (e: React.MouseEvent) => {
                  e.preventDefault();
                  if (!session.id || isPast) return;

                  const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
                  let newSavedSessions: string[];

                  if (isSaved) {
                    newSavedSessions = savedSessions.filter((id: string) => id !== session.id);
                    setSavedSessionIds(new Set(newSavedSessions));
                    capture('session_unsaved', { session_id: session.id, camp_id: camp?.id, camp_name: camp?.name });

                    try {
                      await fetch(`/api/sessions/${session.id}/save`, { method: 'DELETE' });
                    } catch (err) {
                      console.error('Error unsaving session:', err);
                    }
                  } else {
                    newSavedSessions = [...savedSessions, session.id];
                    setSavedSessionIds(new Set(newSavedSessions));
                    capture('session_saved', { session_id: session.id, camp_id: camp?.id, camp_name: camp?.name });

                    try {
                      await fetch(`/api/sessions/${session.id}/save`, { method: 'POST' });
                    } catch (err) {
                      console.error('Error saving session:', err);
                    }
                  }

                  localStorage.setItem('savedSessions', JSON.stringify(newSavedSessions));
                  window.dispatchEvent(new Event('savedSessionsUpdated'));
                };

                return (
                  <div
                    key={session.id || idx}
                    className={`border border-gray-200 rounded-lg p-6 transition-shadow relative ${
                      isPast ? 'opacity-60 pointer-events-none' : 'hover:shadow-md'
                    }`}
                  >
                    {/* Save Button */}
                    <button
                      onClick={handleSaveToggle}
                      disabled={isPast}
                      className="absolute top-4 right-4 p-2 bg-white hover:bg-gray-50 rounded-full shadow-sm transition-all z-10 disabled:cursor-not-allowed"
                      aria-label={isSaved ? 'Unsave session' : 'Save session'}
                      title={isSaved ? 'Unsave session' : 'Save session'}
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

                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <h3 className={`text-xl font-semibold ${fieldTextClass}`}>
                            {session.label || session.name || `Session ${idx + 1}`}
                          </h3>
                          {isPast && (
                            <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                              Ended
                            </span>
                          )}
                          {status === 'in-progress' && (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              In progress
                            </span>
                          )}
                        </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Dates */}
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Dates</p>
                          <p className={fieldTextClass}>
                            {formatDate(session.start_date)} - {formatDate(session.end_date)}
                          </p>
                        </div>

                        {/* Times */}
                        {session.start_time && session.end_time && (
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Time</p>
                            <p className={fieldTextClass}>
                              {formatTime(session.start_time)} - {formatTime(session.end_time)}
                            </p>
                          </div>
                        )}

                        {/* Days of Week */}
                        {session.days_of_week && session.days_of_week.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Days</p>
                            <p className={fieldTextClass}>{formatDaysOfWeek(session.days_of_week)}</p>
                          </div>
                        )}

                        {/* Age Range */}
                        {(session.min_age != null || session.max_age != null) && (
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Age Range</p>
                            <p className={fieldTextClass}>
                              Ages {session.min_age ?? '?'} - {session.max_age ?? '?'}
                            </p>
                          </div>
                        )}

                        {/* Price */}
                        {session.price != null && (
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Price</p>
                            <p className={`text-lg font-semibold ${isPast ? 'text-gray-500' : 'text-green-600'}`}>
                              ${session.price.toFixed(2)}
                            </p>
                          </div>
                        )}

                        {/* Capacity */}
                        {session.capacity != null && (
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Capacity</p>
                            <p className={fieldTextClass}>{session.capacity} spots</p>
                          </div>
                        )}
                      </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </>
          )}
        </div>

        {/* Footnote — deliberately quiet. Detail page only; the cards stay uncluttered. */}
        <p className="mt-6 text-center text-xs text-gray-400">
          Something look wrong?{' '}
          <a
            href={reportUrl}
            onClick={() => capture('report_incorrect_info_clicked', { camp_id: camp.id, camp_name: camp.name })}
            className="underline underline-offset-2 hover:text-gray-600"
          >
            Report incorrect info
          </a>
        </p>
      </div>
    </main>
  );
}

