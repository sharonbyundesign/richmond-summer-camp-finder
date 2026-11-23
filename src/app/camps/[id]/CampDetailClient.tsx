'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { categoryIcon, toCategories } from '@/lib/interest-categories';
import { campInterestImageUrl } from '@/lib/campInterestImage';
import GoogleReviewsLink from '@/components/GoogleReviewsLink';
import { capture } from '@/lib/analytics';
import { feedbackMailto } from '@/lib/contact';
import {
  ACTIVE_SEASON_YEAR,
  formatCheckedAt,
  formatFieldList,
  lowConfidenceFields,
  provenanceSentence,
  summarizeTrust,
  trustBadge,
} from '@/lib/trust';
import TrustBadge from '@/components/TrustBadge';
import { sessionLocation, visibleLocations, type CampLocation } from '@/lib/locations';
import { siteLabel } from '@/lib/v2/geo';
import NotifyMeButton from '@/components/NotifyMeButton';
import SiteHeader from '@/components/SiteHeader';
import ParentCheckins from '@/components/ParentCheckins';
import RegistrationBlock from '@/components/RegistrationBlock';
import type { CampRegistration } from '@/types/camp';
import type { CheckinSummary } from '@/lib/checkins';
import type { VerificationStatus } from '@/types/database';
import { parseLocalDate } from '@/lib/v2/weeks';
import { campFacts } from '@/lib/campFacts';
import type { CampSession as CampFactsSession } from '@/types/camp';

interface CampSession {
  id?: string;
  /** The site this session runs at (migration 007). */
  location_id?: string | null;
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
  // Provenance (migration 001); absent until that migration is applied.
  source_url?: string | null;
  season_year?: number | null;
  last_verified_at?: string | null;
  verification_status?: VerificationStatus;
  confidence_dates?: number | null;
  confidence_price?: number | null;
  confidence_ages?: number | null;
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
  /** Every in-area site this camp runs at (migration 007). */
  camp_locations?: CampLocation[];
  /** When registration opens, per summer (migration 010). */
  camp_registrations?: CampRegistration[];
  description?: string;
  website_url?: string;
  image_url?: string;
  /** Not in the camps table yet; the reviews link falls back to a Maps search until it is. */
  place_id?: string | null;
  zipcode_id?: number;
  camp_sessions?: CampSession[];
  camp_interests?: CampInterest[];
  source_url?: string | null;
  season_year?: number | null;
  last_verified_at?: string | null;
  verification_status?: VerificationStatus;
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

export default function CampDetailClient({
  initialCamp,
  checkinSummary = null,
  checkinsEnabled = false,
}: {
  initialCamp: Camp;
  /** Parents' check-ins (migration 009); null when there are none to read. */
  checkinSummary?: CheckinSummary | null;
  /** New check-ins can be confirmed by email. */
  checkinsEnabled?: boolean;
}) {
  // Rendered on the server with the camp already in hand, so the markup a
  // crawler receives is the finished page rather than a loading state. The
  // state below is kept so the existing loading/error branches still hold for
  // anything that sets them later.
  const [camp] = useState<Camp | null>(initialCamp);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const [savedSessionIds, setSavedSessionIds] = useState<Set<string>>(new Set());
  /** On big camps, show only sessions that fit this age. */
  const [sessionAge, setSessionAge] = useState<number | null>(null);

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

  // The camp arrives from the server component; nothing to fetch here.

  /**
   * "June 7–11, 2027", "Jun 28 – Jul 1, 2027", or with both years when a
   * range crosses one. Short enough to sit on one line in a three-column card.
   */
  const formatDateRange = (startString: string, endString: string) => {
    // parseLocalDate, not new Date: a bare YYYY-MM-DD is parsed as UTC
    // midnight, which in Richmond renders as the day before.
    const start = parseLocalDate(startString);
    const end = parseLocalDate(endString);
    if (!start || !end) return `${startString} – ${endString}`;
    const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-US', opts);
    if (start.getFullYear() !== end.getFullYear()) {
      return `${fmt(start, { month: 'short', day: 'numeric', year: 'numeric' })} – ${fmt(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    const year = start.getFullYear();
    if (start.getMonth() === end.getMonth()) {
      return start.getDate() === end.getDate()
        ? `${fmt(start, { month: 'long', day: 'numeric' })}, ${year}`
        : `${fmt(start, { month: 'long', day: 'numeric' })}–${end.getDate()}, ${year}`;
    }
    return `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(end, { month: 'short', day: 'numeric' })}, ${year}`;
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

  /** "Mon–Fri" for a run of consecutive days, else "Tue, Thu". */
  const formatDaysOfWeek = (days?: string[]) => {
    if (!days || days.length === 0) return '';
    const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const idx = days.map((d) => order.indexOf(d.trim().toLowerCase()));
    const short = (d: string) => d.trim().slice(0, 3).replace(/^./, (c) => c.toUpperCase());
    const consecutive =
      idx.every((i) => i >= 0) && idx.length >= 3 && idx.every((i, n) => n === 0 || i === idx[n - 1] + 1);
    return consecutive ? `${short(days[0])}–${short(days[days.length - 1])}` : days.map(short).join(', ');
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

  const trust = summarizeTrust(camp);
  const badge = trustBadge(trust);

  const facts = campFacts(camp.camp_sessions as CampFactsSession[] | undefined);


  /** One session card. Used flat for small camps and inside week groups for big ones. */
  const renderSession = (session: CampSession, idx: number) => {
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
                            {formatDateRange(session.start_date, session.end_date)}
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

                        {/* Where — only worth a line when the camp runs in more
                            than one place; otherwise the header already says it. */}
                        {visibleLocations(camp).length > 1 && (() => {
                          const site = sessionLocation(camp, session);
                          return (
                            <div className="col-span-2">
                              <p className="text-sm font-medium text-gray-500 mb-1">Location</p>
                              <p className={fieldTextClass}>
                                {site ? siteLabel(site) ?? site.address ?? 'Location' : 'Not confirmed — check with the camp'}
                              </p>
                            </div>
                          );
                        })()}

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

                      {/* Per-session provenance. A camp can have one week
                          confirmed and the next five guessed, so this is per
                          session rather than rolled up into the camp badge. */}
                      {(() => {
                        if (session.verification_status === undefined) return null;

                        const low = lowConfidenceFields(session);
                        const checkedAt = formatCheckedAt(session.last_verified_at ?? null);

                        if (low.length > 0) {
                          return (
                            <p className="mt-4 text-xs text-amber-800 first-letter:uppercase">
                              {formatFieldList(low)} unconfirmed — check with the camp before you
                              register.
                            </p>
                          );
                        }

                        if (session.verification_status === 'camp_confirmed') {
                          return (
                            <p className="mt-4 text-xs text-green-700">
                              Confirmed by the camp{checkedAt ? ` in ${checkedAt}` : ''}.
                            </p>
                          );
                        }

                        if (session.verification_status === 'human_checked' && checkedAt) {
                          return (
                            <p className="mt-4 text-xs text-gray-500">Checked {checkedAt}.</p>
                          );
                        }

                        return null;
                      })()}
                      </div>
                    </div>
                  </div>
                );
  };

  // Big camps (Steward lists 300+ sessions) are grouped by week with an age
  // picker; a small camp's handful of cards reads fine as one grid.
  const GROUP_AT = 12;
  const grouped = sortedSessions.length > GROUP_AT;
  const ageOptions = (() => {
    const lo = Math.min(...sortedSessions.map((s) => s.min_age ?? Infinity));
    const hi = Math.max(...sortedSessions.map((s) => s.max_age ?? -Infinity));
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return [] as number[];
    return Array.from({ length: Math.min(hi, 18) - lo + 1 }, (_, i) => lo + i);
  })();
  const visibleSessions =
    sessionAge === null
      ? sortedSessions
      : sortedSessions.filter((s) => (s.min_age ?? 0) <= sessionAge && sessionAge <= (s.max_age ?? 99));
  const sessionGroups = (() => {
    const weeks = new Map<string, CampSession[]>();
    const past: CampSession[] = [];
    for (const s of visibleSessions) {
      if (getSessionStatus(s, todayNY) === 'past') {
        past.push(s);
        continue;
      }
      const d = parseLocalDate(s.start_date);
      if (!d) continue;
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      weeks.set(key, [...(weeks.get(key) ?? []), s]);
    }
    const byTime = (a: CampSession, b: CampSession) =>
      (a.start_time ?? '99').localeCompare(b.start_time ?? '99') || (a.name ?? '').localeCompare(b.name ?? '');
    const groups = Array.from(weeks.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, list]) => {
        const friday = new Date(`${key}T12:00:00`);
        friday.setDate(friday.getDate() + 4);
        const fridayIso = `${friday.getFullYear()}-${String(friday.getMonth() + 1).padStart(2, '0')}-${String(friday.getDate()).padStart(2, '0')}`;
        return { key, label: `Week of ${formatDateRange(key, fridayIso)}`, sessions: list.sort(byTime) };
      });
    if (past.length) {
      groups.push({ key: 'past', label: `Past sessions (${dateOnly(past[0].end_date).slice(0, 4)})`, sessions: past });
    }
    return groups;
  })();

  const reportUrl = feedbackMailto(`Incorrect info: ${camp.name}`);

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />
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

              {/* Interests sit on the photo, as on the list card. */}
              {(() => {
                const categories = toCategories(
                  (camp.camp_interests || []).map((i) => i.tag || i.interest_name)
                );
                return categories.length > 0 ? (
                  <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <Link
                        key={category}
                        href={`/?interest=${encodeURIComponent(category)}`}
                        onClick={() => capture('tag_pill_clicked', { interest: category, camp_id: camp.id })}
                        aria-label={`See all ${category} camps`}
                        className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-white active:bg-gray-100"
                      >
                        <span aria-hidden="true">{categoryIcon(category)}</span>
                        {category}
                      </Link>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>

            {/* Camp Info — stacked, right side */}
            <div className="flex-1 p-6 flex flex-col">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{camp.name}</h1>
                <TrustBadge badge={badge} />
              </div>

              {/* Several sites: list them, because "one address" would tell a
                  parent the camp only runs there. */}
              {visibleLocations(camp).length > 1 ? (
                <div className="mb-4 text-gray-600">
                  <p className="flex items-center gap-2 font-medium text-gray-800">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {visibleLocations(camp).length} locations
                  </p>
                  <ul className="mt-1.5 space-y-0.5 pl-7 text-sm">
                    {visibleLocations(camp).map((site) => (
                      <li key={site.id}>
                        <span className="font-medium text-gray-700">{siteLabel(site) ?? 'Location'}</span>
                        {site.address && site.address !== siteLabel(site) && (
                          <span className="text-gray-500"> · {site.address}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : camp.location && (
                <p className="text-gray-600 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {camp.location}
                </p>
              )}

              {/* The four things parents filter on, answered before they scroll. */}
              {facts && (
                <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-gray-100 py-4 sm:grid-cols-4">
                  {[
                    ['Ages', facts.ages],
                    ['Price', facts.price],
                    ['Day', facts.day],
                    ['Weeks', facts.weeks, facts.weeksRange],
                  ].map(([label, value, sub]) => (
                    <div key={label}>
                      <dt className="text-sm text-gray-500">{label}</dt>
                      <dd className={value ? 'font-semibold text-gray-900' : 'text-gray-400'}>
                        {value ?? 'Not listed'}
                      </dd>
                      {sub && <dd className="text-sm text-gray-500">{sub}</dd>}
                    </div>
                  ))}
                </dl>
              )}

              <RegistrationBlock camp={camp} />

              {camp.description && (
                <p className="text-gray-700 mb-4 leading-relaxed">{camp.description}</p>
              )}

              {/* Reviews left, the registration CTA right — where the eye
                  lands last, and where the external arrow says it leaves. */}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                {/* Secondary by design — it must not compete with the registration CTA. */}
                <GoogleReviewsLink camp={camp} />

                {camp.website_url && (
                  <a
                    href={camp.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => capture('camp_website_visited', { camp_id: camp.id, camp_name: camp.name })}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-medium"
                  >
                    Visit Website
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M9 7h8v8" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <ParentCheckins
          campId={camp.id}
          campName={camp.name}
          summary={checkinSummary}
          enabled={checkinsEnabled}
        />

        {/* Sessions Section — hidden entirely when no sessions have been added yet */}
        {sortedSessions.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Camp Sessions ({sortedSessions.length})
          </h2>

          {/* The stale notice below already says whose dates these are. */}
          {allSessionsPast && !(trust.known && trust.isStale) && (
            <p className="mb-4 text-sm text-gray-600">
              All {mostRecentSessionYear} sessions have ended.
            </p>
          )}

          {/* Where these sessions came from and how far to trust them. This sits
              directly above the data it describes rather than in a footer. */}
          {trust.known && (
            <div
              className={`mb-6 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
                trust.isStale ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <p className="text-sm text-gray-800">
                {trust.isStale
                  ? `These are ${trust.seasonYear} dates. ${ACTIVE_SEASON_YEAR} dates aren't posted yet.`
                  : provenanceSentence(trust)}
                {trust.lowConfidenceFields.length > 0 &&
                  ` Treat the ${formatFieldList(trust.lowConfidenceFields)} as approximate.`}
                {trust.sourceUrl && ' '}
              {trust.sourceUrl && (
                <a
                  href={trust.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    capture('camp_source_clicked', {
                      camp_id: camp.id,
                      camp_name: camp.name,
                      url: trust.sourceUrl,
                    })
                  }
                  className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-blue-600 hover:underline"
                >
                  Source
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
              </p>

              {/* Only when we hold no dates for the season parents are planning
                  — the moment someone most needs to hear back, and the one
                  place the page has nothing better to offer them. */}
              {trust.isStale && (
                <NotifyMeButton
                  campId={camp.id}
                  campName={camp.name}
                  seasonYear={ACTIVE_SEASON_YEAR}
                  className="shrink-0 self-start sm:self-auto"
                />
              )}
            </div>
          )}
          {grouped && (
            <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Your child&rsquo;s age
                <select
                  value={sessionAge ?? ''}
                  onChange={(e) => setSessionAge(e.target.value === '' ? null : Number(e.target.value))}
                  className="select-pill rounded-full border border-gray-300 bg-white py-1.5 pl-4 pr-10 text-sm text-gray-900"
                >
                  <option value="">Any age</option>
                  {ageOptions.map((age) => (
                    <option key={age} value={age}>
                      {age}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-sm text-gray-500">
                {visibleSessions.length} {visibleSessions.length === 1 ? 'session' : 'sessions'}
                {sessionAge !== null ? ` for age ${sessionAge}` : ''} in {sessionGroups.length}{' '}
                {sessionGroups.length === 1 ? 'group' : 'groups'}
              </span>
            </div>
          )}

          {grouped ? (
            <div className="divide-y divide-gray-200 border-y border-gray-200">
              {sessionGroups.map((group, gi) => (
                <details key={group.key} open={gi === 0 || sessionAge !== null ? true : undefined} className="group/week">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <svg aria-hidden="true" className="h-4 w-4 text-gray-500 transition-transform group-open/week:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-lg font-semibold text-gray-900">{group.label}</span>
                    </span>
                    <span className="text-sm text-gray-500">
                      {group.sessions.length} {group.sessions.length === 1 ? 'session' : 'sessions'}
                    </span>
                  </summary>
                  <div className="grid grid-cols-1 gap-6 pb-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
                    {group.sessions.map((session) => renderSession(session, sortedSessions.indexOf(session)))}
                  </div>
                </details>
              ))}
              {sessionGroups.length === 0 && (
                <p className="py-6 text-sm text-gray-600">
                  No sessions list age {sessionAge}.{' '}
                  <button type="button" onClick={() => setSessionAge(null)} className="font-medium text-blue-600 hover:underline">
                    Show all ages
                  </button>
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {sortedSessions.map((session, idx) => renderSession(session, idx))}
            </div>
          )}
        </div>
        )}

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
          <span aria-hidden="true"> · </span>
          <span className="whitespace-nowrap">
            Run this camp?{' '}
            <Link
              href={`/camps/${camp.id}/update`}
              onClick={() => capture('camp_update_link_clicked', { camp_id: camp.id, camp_name: camp.name })}
              className="underline underline-offset-2 hover:text-gray-600"
            >
              Add your {ACTIVE_SEASON_YEAR} dates
            </Link>
          </span>
        </p>
      </div>
    </main>
  );
}

