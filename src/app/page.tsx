'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import FilterPanel from '@/components/FilterPanel';
import CampCard from '@/components/CampCard';
import CampCardSkeleton from '@/components/CampCardSkeleton';
import {
  Filters,
  emptyFilters,
  parseFiltersFromParams,
  filtersToSearchParams,
  countActiveFilters,
  weekMonthName,
  isWeekPast,
} from '@/lib/campFilters';

const CampsMap = dynamic(() => import('@/components/CampsMap'), { ssr: false });

interface Camp {
  id: string;
  name: string;
  location?: string;
  description?: string;
  website_url?: string;
  zipcode_id?: number;
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

interface WeekOption {
  weekStart: string;
  label: string;
}

function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Applied filters live in the URL — shareable and survive refresh.
  const searchKey = searchParams.toString();
  const applied = useMemo(
    () => parseFiltersFromParams(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchKey],
  );

  // Data
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableInterests, setAvailableInterests] = useState<string[]>([]);
  const [weeks, setWeeks] = useState<WeekOption[]>([]);

  // Promo banner: non-past July/August start-weeks derived from real data.
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const summerWeeks = useMemo(
    () =>
      weeks
        .map((w) => w.weekStart)
        .filter((ws) => {
          const month = weekMonthName(ws);
          return (month === 'July' || month === 'August') && !isWeekPast(ws);
        }),
    [weeks],
  );
  const summerApplied =
    summerWeeks.length > 0 &&
    summerWeeks.every((ws) => applied.weeks.includes(ws));
  const showSummerBanner = !bannerDismissed && summerWeeks.length > 0 && !summerApplied;

  // Filter panel (staged filters + live count)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [staged, setStaged] = useState<Filters>(applied);
  const [stagedCount, setStagedCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // Fetch available interests on mount
  useEffect(() => {
    const fetchInterests = async () => {
      try {
        const response = await fetch('/api/interests');
        if (!response.ok) return;
        const data = await response.json();
        if (data.error) return;
        if (Array.isArray(data.interests)) setAvailableInterests(data.interests);
      } catch (err) {
        console.error('Error fetching interests:', err);
      }
    };
    fetchInterests();
  }, []);

  // Fetch the list of distinct session weeks on mount
  useEffect(() => {
    const fetchWeeks = async () => {
      try {
        const response = await fetch('/api/weeks');
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data.weeks)) setWeeks(data.weeks);
      } catch (err) {
        console.error('Error fetching weeks:', err);
      }
    };
    fetchWeeks();
  }, []);

  // Fetch camps whenever the applied (URL) filters change.
  const fetchCamps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = filtersToSearchParams(applied).toString();
      const response = await fetch(`/api/camps${query ? `?${query}` : ''}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Unable to load camps. Please try again later.');
        setCamps([]);
        return;
      }
      const data = await response.json();
      if (data.error) {
        setError(data.error);
        setCamps([]);
      } else {
        setCamps(Array.isArray(data.camps) ? data.camps : []);
      }
    } catch (err) {
      console.error('Error fetching camps from Supabase:', err);
      setError('Unable to connect to the database. Please check your connection and try again.');
      setCamps([]);
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    fetchCamps();
  }, [fetchCamps]);

  // Live count for the "Show N camps" button — debounced query against the API
  // using the same filter logic as the results, while the panel is open.
  const stagedKey = filtersToSearchParams(staged).toString();
  useEffect(() => {
    if (!sidebarOpen) return;
    let cancelled = false;
    setCountLoading(true);
    const handle = setTimeout(async () => {
      try {
        const response = await fetch(`/api/camps?count=1${stagedKey ? `&${stagedKey}` : ''}`);
        const data = await response.json();
        if (!cancelled && typeof data.count === 'number') setStagedCount(data.count);
      } catch (err) {
        if (!cancelled) console.error('Error fetching count:', err);
      } finally {
        if (!cancelled) setCountLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [stagedKey, sidebarOpen]);

  const openPanel = () => {
    setStaged(applied);
    setStagedCount(camps.length);
    setSidebarOpen(true);
  };

  const patchStaged = (patch: Partial<Filters>) => {
    setStaged((prev) => ({ ...prev, ...patch }));
  };

  const applyFilters = () => {
    const query = filtersToSearchParams(staged).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    setSidebarOpen(false);
  };

  const clearAll = () => {
    setStaged(emptyFilters());
  };

  // Banner action: layer the non-past July/August weeks onto the current
  // filters. Selecting only future weeks inherently drops past sessions.
  const applySummerFilter = () => {
    const next: Filters = { ...applied, weeks: summerWeeks };
    const query = filtersToSearchParams(next).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const activeFilterCount = countActiveFilters(applied);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Promo banner: July & August availability */}
      {showSummerBanner && (
        <div className="relative z-40 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <button
            type="button"
            onClick={applySummerFilter}
            className="group w-full text-left"
          >
            <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-2.5 pr-12 flex items-center gap-3">
              <span className="text-lg leading-none" aria-hidden="true">☀️</span>
              <p className="text-sm font-medium">
                Spots still open for July &amp; August!
                <span className="ml-2 inline-flex items-center gap-1 font-semibold underline decoration-white/40 underline-offset-2 group-hover:decoration-white">
                  See available camps
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors"
            aria-label="Dismiss banner"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 pt-4 sm:pt-6 pb-4 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 sticky top-0 z-30">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
              Richmond Summer Camp Finder
            </h1>
            <p className="text-sm text-gray-500">
              Find the perfect summer camp for your child
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated July 10, 2026
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openPanel}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
                activeFilterCount > 0
                  ? 'border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 12h12M10 20h4" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <Link
              href="/saved"
              className="text-gray-700 hover:text-gray-900 font-medium text-sm"
            >
              Saved
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 xl:px-12 pt-6 sm:pt-8 pb-6 sm:pb-8 relative">
        {/* Filter overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed left-1/2 top-20 -translate-x-1/2 w-[92vw] max-w-4xl z-50">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[calc(100vh-7rem)]">
                <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="h-9 w-9 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-gray-800"
                    aria-label="Close filters"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="overflow-y-auto px-4 sm:px-6 py-5">
                  <FilterPanel
                    filters={staged}
                    onChange={patchStaged}
                    availableInterests={availableInterests}
                    weeks={weeks}
                  />
                </div>

                {/* Footer: Clear all + live-count apply button */}
                <div className="border-t border-gray-100 px-4 sm:px-6 py-4">
                  {stagedCount === 0 && (
                    <p className="text-sm text-amber-600 mb-2 text-right">
                      No camps match. Try removing a filter.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <button
                      onClick={clearAll}
                      className="text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                      Clear all
                    </button>
                    <button
                      onClick={applyFilters}
                      className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                    >
                      {countLoading || stagedCount === null
                        ? 'Show camps'
                        : `Show ${stagedCount} camp${stagedCount === 1 ? '' : 's'}`}
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] gap-6">
          <div>
            {loading && (
              <>
                <div className="mb-4">
                  <p className="text-gray-600">Loading camps...</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                  {Array.from({ length: 6 }).map((_, idx) => (
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
                    <p className="text-red-800 font-medium">Unable to load camps</p>
                    <p className="text-red-700 text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {!loading && !error && (
              <>
                <div className="mb-4">
                  <p className="text-gray-600">
                    {camps.length === 0
                      ? 'No camps found. Try adjusting your filters.'
                      : `Found ${camps.length} camp${camps.length === 1 ? '' : 's'}`}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-5">
                  {camps.map((camp) => (
                    <CampCard key={camp.id} camp={camp} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="xl:sticky xl:top-24 h-fit">
            <CampsMap camps={camps} />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
