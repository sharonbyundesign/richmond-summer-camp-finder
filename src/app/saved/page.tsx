'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import CampCard from '@/components/CampCard';
import CampCardSkeleton from '@/components/CampCardSkeleton';
import SessionCard from '@/components/SessionCard';
import SiteHeader from '@/components/SiteHeader';
import RegistrationPlan from '@/components/RegistrationPlan';
import { parseLocalDate, startOfWeek, toKey } from '@/lib/v2/weeks';
import { campInterestImageUrl } from '@/lib/campInterestImage';
import type { CampRegistration } from '@/types/camp';

interface Camp {
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
  /** When registration opens, per summer (migration 010). */
  camp_registrations?: CampRegistration[];
}

interface SavedSession {
  id: string;
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
  camp_id: string;
  camps?: {
    id: string;
    name: string;
    location?: string;
    image_url?: string | null;
    camp_interests?: Array<{ id?: string; tag?: string; interest_name?: string }>;
  };
}

interface WeekGroup {
  key: string;
  label: string;
  weekSessions: SavedSession[];
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Week of Jun 1–5", "Week of Jun 28 – Jul 2": from `from` (the Monday, or the
 * first session's start when the week opens late, as after Memorial Day) to
 * that week's Friday.
 */
function weekLabel(monday: Date, from: Date = monday): string {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const a = `${SHORT_MONTHS[from.getMonth()]} ${from.getDate()}`;
  return friday.getMonth() === from.getMonth()
    ? `Week of ${a}–${friday.getDate()}`
    : `Week of ${a} – ${SHORT_MONTHS[friday.getMonth()]} ${friday.getDate()}`;
}

/**
 * Saved sessions by the week they start, so the options for one week sit side
 * by side: a parent picks one per week. Weeks between the first and last saved
 * week with nothing saved come back empty, so gaps in the summer show too.
 */
function groupSessionsByWeek(sessions: SavedSession[]): WeekGroup[] {
  const groups = new Map<string, WeekGroup>();
  const undated: SavedSession[] = [];

  sessions.forEach((session) => {
    // parseLocalDate: new Date('2027-06-01') is UTC midnight, which in
    // Richmond is the day before.
    const date = session.start_date ? parseLocalDate(session.start_date) : null;
    if (!date || isNaN(date.getTime())) {
      undated.push(session);
      return;
    }
    const monday = startOfWeek(date);
    const key = toKey(monday);
    if (!groups.has(key)) groups.set(key, { key, label: '', weekSessions: [] });
    groups.get(key)!.weekSessions.push(session);
  });

  groups.forEach((g) => {
    const monday = parseLocalDate(g.key)!;
    const firstStart = g.weekSessions
      .map((x) => parseLocalDate(x.start_date)!)
      .reduce((min, d) => (d < min ? d : min));
    g.label = weekLabel(monday, firstStart > monday && firstStart.getDay() <= 5 ? firstStart : monday);
  });

  // Earliest start first within a week, then shortest (a half day before a full one).
  groups.forEach((g) =>
    g.weekSessions.sort(
      (x, y) =>
        (x.start_time ?? '99').localeCompare(y.start_time ?? '99') ||
        (x.end_time ?? '99').localeCompare(y.end_time ?? '99'),
    ),
  );

  const ordered = Array.from(groups.values()).sort((x, y) => x.key.localeCompare(y.key));

  // Fill the gaps within one summer (not across years of saved sessions).
  if (ordered.length > 1) {
    const first = parseLocalDate(ordered[0].key)!;
    const last = parseLocalDate(ordered[ordered.length - 1].key)!;
    if (first.getFullYear() === last.getFullYear()) {
      for (const d = new Date(first); d < last; d.setDate(d.getDate() + 7)) {
        const key = toKey(d);
        if (!groups.has(key)) ordered.push({ key, label: weekLabel(new Date(d)), weekSessions: [] });
      }
      ordered.sort((x, y) => x.key.localeCompare(y.key));
    }
  }

  if (undated.length > 0) {
    ordered.push({ key: 'undated', label: 'Dates TBD', weekSessions: undated });
  }

  return ordered;
}

export default function SavedCampsPage() {
  const [savedCampIds, setSavedCampIds] = useState<string[]>([]);
  const [savedSessionIds, setSavedSessionIds] = useState<string[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  /** Which saved items to show: everything, only camps, or only sessions. */
  const [view, setView] = useState<'all' | 'camps' | 'sessions'>('all');
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Load saved camp and session IDs from localStorage
  useEffect(() => {
    const savedCamps = JSON.parse(localStorage.getItem('savedCamps') || '[]');
    const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
    
    // Only update state if values have changed
    setSavedCampIds(prev => {
      const campsEqual = prev.length === savedCamps.length && 
        prev.every((id, idx) => id === savedCamps[idx]);
      return campsEqual ? prev : savedCamps;
    });
    
    setSavedSessionIds(prev => {
      const sessionsEqual = prev.length === savedSessions.length && 
        prev.every((id, idx) => id === savedSessions[idx]);
      return sessionsEqual ? prev : savedSessions;
    });
  }, []);

  // Fetch saved camps from API
  useEffect(() => {
    const fetchSavedCamps = async () => {
      if (savedCampIds.length === 0) {
        setCamps([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch all camps and filter to only saved ones
        const response = await fetch('/api/camps');
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData.error || 'Unable to load saved camps.');
          setCamps([]);
          return;
        }

        const data = await response.json();

        if (data.error) {
          setError(data.error);
          setCamps([]);
        } else {
          // Filter to only show saved camps
          const savedCamps = (data.camps || []).filter((camp: Camp) =>
            savedCampIds.includes(camp.id)
          );
          setCamps(savedCamps);
        }
      } catch (err) {
        console.error('Error fetching saved camps:', err);
        setError('Unable to connect to the database. Please check your connection and try again.');
        setCamps([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSavedCamps();
  }, [savedCampIds]);

  // Fetch saved sessions from API
  useEffect(() => {
    const fetchSavedSessions = async () => {
      if (savedSessionIds.length === 0) {
        setSessions([]);
        setSessionsLoading(false);
        return;
      }

      setSessionsLoading(true);
      setSessionsError(null);

      try {
        const params = new URLSearchParams();
        savedSessionIds.forEach(id => params.append('id', id));

        const response = await fetch(`/api/sessions?${params.toString()}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setSessionsError(errorData.error || 'Unable to load saved sessions.');
          setSessions([]);
          return;
        }

        const data = await response.json();

        if (data.error) {
          setSessionsError(data.error);
          setSessions([]);
        } else {
          setSessions(data.sessions || []);
        }
      } catch (err) {
        console.error('Error fetching saved sessions:', err);
        setSessionsError('Unable to connect to the database.');
        setSessions([]);
      } finally {
        setSessionsLoading(false);
      }
    };

    fetchSavedSessions();
  }, [savedSessionIds]);

  // Listen for storage changes to update when camps/sessions are saved/unsaved
  useEffect(() => {
    const handleStorageChange = () => {
      const savedCamps = JSON.parse(localStorage.getItem('savedCamps') || '[]');
      const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
      
      setSavedCampIds(prev => {
        const campsEqual = prev.length === savedCamps.length && 
          prev.every((id, idx) => id === savedCamps[idx]);
        return campsEqual ? prev : savedCamps;
      });
      
      setSavedSessionIds(prev => {
        const sessionsEqual = prev.length === savedSessions.length && 
          prev.every((id, idx) => id === savedSessions[idx]);
        return sessionsEqual ? prev : savedSessions;
      });
    };

    // Listen for custom events when localStorage changes in same tab
    const handleCampsUpdated = () => {
      const savedCamps = JSON.parse(localStorage.getItem('savedCamps') || '[]');
      setSavedCampIds(prev => {
        const campsEqual = prev.length === savedCamps.length && 
          prev.every((id, idx) => id === savedCamps[idx]);
        return campsEqual ? prev : savedCamps;
      });
    };

    const handleSessionsUpdated = () => {
      const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
      setSavedSessionIds(prev => {
        const sessionsEqual = prev.length === savedSessions.length && 
          prev.every((id, idx) => id === savedSessions[idx]);
        return sessionsEqual ? prev : savedSessions;
      });
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('savedCampsUpdated', handleCampsUpdated);
    window.addEventListener('savedSessionsUpdated', handleSessionsUpdated);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('savedCampsUpdated', handleCampsUpdated);
      window.removeEventListener('savedSessionsUpdated', handleSessionsUpdated);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* The wordmark bar every non-finder page carries, so this page reads as
          part of Scouty rather than as a standalone screen. "Saved Items" is
          the h1 — the wordmark above is a link — and it is sized to match the
          wordmark instead of towering over it. */}
      <SiteHeader />

      {/* The visible title said nothing the section headings below do not —
          "Saved Camps (3)" already names the page. It stays as the document's
          h1 for screen readers and crawlers, which still need one heading that
          says what this page is; the wordmark above is the same everywhere. */}
      <h1 className="sr-only">Saved Items</h1>

      <div className="px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 xl:px-12 pb-6 sm:pb-8">
        {loading && (
          <>
            <div className="mb-4">
              <p className="text-gray-600">Loading saved camps...</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 4 }).map((_, idx) => (
                <CampCardSkeleton key={`skeleton-${idx}`} />
              ))}
            </div>
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-red-800 font-medium">Unable to load saved camps</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {camps.length === 0 && savedSessionIds.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-12 text-center">
                <svg
                  className="w-16 h-16 text-gray-400 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">No saved items yet</h2>
                <p className="text-gray-600 mb-6">
                  Start exploring camps and sessions, and save your favorites to see them here.
                </p>
                <Link
                  href="/"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-medium"
                >
                  Browse Camps
                </Link>
              </div>
            ) : (
              <>
                {/* All / Camps / Sessions: one tap to see just one kind. */}
                <div role="tablist" aria-label="Show saved" className="mb-6 flex flex-wrap gap-2">
                  {([
                    ['all', 'All', camps.length + savedSessionIds.length],
                    ['camps', 'Camps', camps.length],
                    ['sessions', 'Sessions', savedSessionIds.length],
                  ] as const).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={view === value}
                      onClick={() => setView(value)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                        view === value
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {label} <span className={view === value ? 'text-gray-300' : 'text-gray-500'}>{count}</span>
                    </button>
                  ))}
                </div>

                {view !== 'sessions' && <RegistrationPlan camps={camps} />}

                {/* Saved Camps Section */}
                {view !== 'sessions' && camps.length > 0 && (
                  <div className="mb-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                      Saved Camps ({camps.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                      {camps.map((camp) => (
                        <CampCard key={camp.id} camp={camp} />
                      ))}
                    </div>
                  </div>
                )}

                {view === 'camps' ? null : (
                <>
                {/* Saved Sessions Section */}
                {sessionsLoading && savedSessionIds.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-600">Loading saved sessions...</p>
                  </div>
                )}

                {sessionsError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-red-800 font-medium">Unable to load saved sessions</p>
                        <p className="text-red-700 text-sm mt-1">{sessionsError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {!sessionsLoading && sessions.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                      Saved Sessions ({sessions.length})
                    </h2>

                    {/* One row per week, so a week's options can be compared side by side. */}
                    <div className="space-y-8">
                      {groupSessionsByWeek(sessions).map(({ key, label, weekSessions }) =>
                        weekSessions.length === 0 ? (
                          <div key={key} className="flex items-baseline gap-3 border-t border-gray-200 pt-4">
                            <h3 className="text-base font-semibold text-gray-400">{label}</h3>
                            <span className="text-sm text-gray-400">Nothing saved</span>
                          </div>
                        ) : (
                          <div key={key} className="border-t border-gray-200 pt-4">
                            <div className="mb-4 flex flex-wrap items-baseline gap-3">
                              <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
                              {key !== 'undated' && weekSessions.length > 1 && (
                                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                  {weekSessions.length} options
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                              {weekSessions.map((session) => {
                                const camp = session.camps;
                                if (!camp || !session.id) return null;
                                return (
                                  <SessionCard
                                    key={session.id}
                                    session={session}
                                    campId={camp.id}
                                    campName={camp.name}
                                    campImage={campInterestImageUrl(camp.id, camp.camp_interests) ?? camp.image_url ?? null}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {!sessionsLoading && !sessionsError && savedSessionIds.length > 0 && sessions.length === 0 && (
                  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center">
                    <p className="text-gray-600">No saved sessions found.</p>
                  </div>
                )}
                </>
                )}

                {/* An empty tab says so, rather than showing a blank page. */}
                {((view === 'camps' && camps.length === 0) || (view === 'sessions' && savedSessionIds.length === 0)) && (
                  <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">
                    No saved {view} yet.{' '}
                    <Link href="/" className="font-medium text-blue-600 hover:underline">
                      Browse camps
                    </Link>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

