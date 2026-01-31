'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import FilterPanel from '@/components/FilterPanel';
import CampCard from '@/components/CampCard';
import CampCardSkeleton from '@/components/CampCardSkeleton';

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

interface Child {
  id: number;
  name: string;
  age: number;
}

export default function Home() {
  // Child selection
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  
  // Filters
  const [age, setAge] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'full-day' | ''>('');
  const [zipcode, setZipcode] = useState('');
  const [maxDistance, setMaxDistance] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [hideConflicts, setHideConflicts] = useState(false);
  
  // Data
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableInterests, setAvailableInterests] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Fetch children on mount (if you have an API for this)
  useEffect(() => {
    // TODO: Fetch children from API if you have one
    // For now, this is a placeholder - you'll need to implement the API call
    // const fetchChildren = async () => {
    //   const response = await fetch('/api/children');
    //   const data = await response.json();
    //   setChildren(data.children || []);
    // };
    // fetchChildren();
  }, []);

  // Fetch available interests on mount
  useEffect(() => {
    const fetchInterests = async () => {
      try {
        const response = await fetch('/api/interests');
        
        if (!response.ok) {
          console.warn('Failed to fetch interests, will extract from camps');
          return;
        }
        
        const data = await response.json();
        
        if (data.error) {
          console.warn('Error fetching interests:', data.error);
          return;
        }
        
        if (data.interests && Array.isArray(data.interests)) {
          setAvailableInterests(data.interests);
        }
      } catch (err) {
        console.error('Error fetching interests:', err);
        // Don't set error state, just log it - interests are optional
      }
    };

    fetchInterests();
  }, []);

  // Fetch camps from Supabase when filters change
  const fetchCamps = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      if (selectedChildId) params.append('childId', selectedChildId);
      if (age) params.append('age', age);
      interests.forEach(interest => params.append('interest', interest));
      if (dateRangeStart) params.append('dateRangeStart', dateRangeStart);
      if (dateRangeEnd) params.append('dateRangeEnd', dateRangeEnd);
      daysOfWeek.forEach(day => params.append('daysOfWeek', day));
      if (timeOfDay) params.append('timeOfDay', timeOfDay);
      if (zipcode) params.append('zipcode', zipcode);
      if (maxDistance) params.append('maxDistance', maxDistance);
      if (minPrice) params.append('minPrice', minPrice);
      if (maxPrice) params.append('maxPrice', maxPrice);
      if (hideConflicts) params.append('hideConflicts', 'true');

      const response = await fetch(`/api/camps?${params.toString()}`);
      
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
        // Ensure we have an array from Supabase
        setCamps(Array.isArray(data.camps) ? data.camps : []);
      }
    } catch (err) {
      console.error('Error fetching camps from Supabase:', err);
      setError('Unable to connect to the database. Please check your connection and try again.');
      setCamps([]);
    } finally {
      setLoading(false);
    }
  }, [
    selectedChildId,
    age,
    interests,
    dateRangeStart,
    dateRangeEnd,
    daysOfWeek,
    timeOfDay,
    zipcode,
    maxDistance,
    minPrice,
    maxPrice,
    hideConflicts,
  ]);

  useEffect(() => {
    fetchCamps();
  }, [fetchCamps]);

  return (
    <main className="min-h-screen bg-gray-50">
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
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
              </svg>
              Filters
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

      <div className="px-4 sm:px-6 lg:px-8 xl:px-12 pb-6 sm:pb-8 relative">
        {/* Filter overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed left-1/2 top-20 -translate-x-1/2 w-[92vw] max-w-4xl z-50">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 sm:p-6 relative">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="absolute top-3 right-3 h-9 w-9 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-gray-800"
                  aria-label="Close filters"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
                <FilterPanel
                  selectedChildId={selectedChildId}
                  childrenList={children}
                  age={age}
                  interests={interests}
                  dateRangeStart={dateRangeStart}
                  dateRangeEnd={dateRangeEnd}
                  daysOfWeek={daysOfWeek}
                  timeOfDay={timeOfDay}
                  zipcode={zipcode}
                  maxDistance={maxDistance}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  hideConflicts={hideConflicts}
                  availableInterests={availableInterests}
                  onChildChange={setSelectedChildId}
                  onAgeChange={setAge}
                  onInterestsChange={setInterests}
                  onDateRangeStartChange={setDateRangeStart}
                  onDateRangeEndChange={setDateRangeEnd}
                  onDaysOfWeekChange={setDaysOfWeek}
                  onTimeOfDayChange={setTimeOfDay}
                  onZipcodeChange={setZipcode}
                  onMaxDistanceChange={setMaxDistance}
                  onMinPriceChange={setMinPrice}
                  onMaxPriceChange={setMaxPrice}
                  onHideConflictsChange={setHideConflicts}
                />
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
