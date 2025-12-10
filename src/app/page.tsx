'use client';

import { useState, useEffect, useCallback } from 'react';
import FilterPanel from '@/components/FilterPanel';
import CampCard from '@/components/CampCard';
import CampCardSkeleton from '@/components/CampCardSkeleton';

interface Camp {
  id: string;
  name: string;
  location?: string;
  description?: string;
  website_url?: string;
  camp_sessions?: Array<{
    start_date: string;
    end_date: string;
    label?: string;
    min_age?: number;
    max_age?: number;
  }>;
  camp_interests?: Array<{
    tag: string;
  }>;
}

export default function Home() {
  const [age, setAge] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [week, setWeek] = useState('');
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableInterests, setAvailableInterests] = useState<string[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);

  // Fetch available interests and weeks on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await fetch('/api/camps');
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData.error || 'Failed to connect to the database. Please check your connection and try again.');
          return;
        }
        
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
          return;
        }
        
        if (data.camps && Array.isArray(data.camps)) {
          // Extract unique interests from Supabase data
          const allInterests = new Set<string>();
          const allWeeks = new Set<string>();
          
          data.camps.forEach((camp: Camp) => {
            camp.camp_interests?.forEach(interest => {
              if (interest?.tag) allInterests.add(interest.tag);
            });
            camp.camp_sessions?.forEach(session => {
              if (session?.start_date) {
                try {
                  // Use Monday of the week
                  const date = new Date(session.start_date);
                  if (!isNaN(date.getTime())) {
                    const day = date.getDay();
                    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
                    const monday = new Date(date.setDate(diff));
                    monday.setHours(0, 0, 0, 0);
                    allWeeks.add(monday.toISOString().split('T')[0]);
                  }
                } catch (dateErr) {
                  console.error('Error parsing session date:', dateErr);
                }
              }
            });
          });
          
          setAvailableInterests(Array.from(allInterests).sort());
          setAvailableWeeks(Array.from(allWeeks).sort());
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
        setError('Unable to connect to the server. Please check your internet connection and try again.');
      }
    };

    fetchInitialData();
  }, []);

  // Fetch camps from Supabase when filters change
  const fetchCamps = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (age) params.append('age', age);
      interests.forEach(interest => params.append('interest', interest));
      if (week) params.append('week', week);

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
  }, [age, interests, week]);

  useEffect(() => {
    fetchCamps();
  }, [fetchCamps]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Richmond Summer Camp Finder
          </h1>
          <p className="text-gray-600">
            Find the perfect summer camp for your child
          </p>
        </div>

        <FilterPanel
          age={age}
          interests={interests}
          week={week}
          availableInterests={availableInterests}
          availableWeeks={availableWeeks}
          onAgeChange={setAge}
          onInterestsChange={setInterests}
          onWeekChange={setWeek}
        />

        {loading && (
          <>
            <div className="mb-4">
              <p className="text-gray-600">Loading camps...</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {camps.map((camp) => (
                <CampCard key={camp.id} camp={camp} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
