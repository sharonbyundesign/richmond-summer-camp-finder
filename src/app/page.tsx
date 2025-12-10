'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import FilterPanel from '@/components/FilterPanel';
import CampCard from '@/components/CampCard';
import CampCardSkeleton from '@/components/CampCardSkeleton';

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
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 pt-6 sm:pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Richmond Summer Camp Finder
            </h1>
            <p className="text-gray-600">
              Find the perfect summer camp for your child
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Saved link */}
            <Link
              href="/saved"
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <svg
                className="w-5 h-5"
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
              <span className="hidden sm:inline">Saved</span>
            </Link>
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              aria-label="Toggle filters"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 sm:px-6 lg:px-8 xl:px-12 pb-6 sm:pb-8 relative">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'block' : 'hidden'
          } lg:block lg:sticky lg:top-6 lg:self-start w-full lg:w-80 flex-shrink-0 relative z-50 lg:z-auto`}
        >
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
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                {camps.map((camp) => (
                  <CampCard key={camp.id} camp={camp} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
