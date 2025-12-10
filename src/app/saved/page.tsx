'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import CampCard from '@/components/CampCard';
import CampCardSkeleton from '@/components/CampCardSkeleton';
import SessionCard from '@/components/SessionCard';

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
  };
}

export default function SavedCampsPage() {
  const [savedCampIds, setSavedCampIds] = useState<string[]>([]);
  const [savedSessionIds, setSavedSessionIds] = useState<string[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Load saved camp and session IDs from localStorage
  useEffect(() => {
    const savedCamps = JSON.parse(localStorage.getItem('savedCamps') || '[]');
    const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
    setSavedCampIds(savedCamps);
    setSavedSessionIds(savedSessions);
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
      setSavedCampIds(savedCamps);
      setSavedSessionIds(savedSessions);
    };

    // Listen for custom events when localStorage changes in same tab
    const handleCampsUpdated = () => {
      const savedCamps = JSON.parse(localStorage.getItem('savedCamps') || '[]');
      setSavedCampIds(savedCamps);
    };

    const handleSessionsUpdated = () => {
      const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
      setSavedSessionIds(savedSessions);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('savedCampsUpdated', handleCampsUpdated);
    window.addEventListener('savedSessionsUpdated', handleSessionsUpdated);
    
    // Also check periodically (for same-tab updates)
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('savedCampsUpdated', handleCampsUpdated);
      window.removeEventListener('savedSessionsUpdated', handleSessionsUpdated);
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 pt-6 sm:pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Saved Items
            </h1>
            <p className="text-gray-600">
              Your favorite camps and sessions
            </p>
          </div>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Back to Search
          </Link>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 xl:px-12 pb-6 sm:pb-8">
        {loading && (
          <>
            <div className="mb-4">
              <p className="text-gray-600">Loading saved camps...</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
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
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Browse Camps
                </Link>
              </div>
            ) : (
              <>
                {/* Saved Camps Section */}
                {camps.length > 0 && (
                  <div className="mb-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                      Saved Camps ({camps.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                      {camps.map((camp) => (
                        <CampCard key={camp.id} camp={camp} />
                      ))}
                    </div>
                  </div>
                )}

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
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                      Saved Sessions ({sessions.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                      {sessions.map((session) => {
                        const camp = session.camps;
                        if (!camp || !session.id) return null;
                        return (
                          <SessionCard
                            key={session.id}
                            session={session}
                            campId={camp.id}
                            campName={camp.name}
                          />
                        );
                      })}
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
          </>
        )}
      </div>
    </main>
  );
}

