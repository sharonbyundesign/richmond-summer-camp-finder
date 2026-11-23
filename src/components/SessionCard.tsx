'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { parseLocalDate } from '@/lib/v2/weeks';

interface SessionCardProps {
  session: {
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
  };
  campId: string;
  campName: string;
  /** The camp's photo, so sessions from different camps are easy to tell apart. */
  campImage?: string | null;
}

export default function SessionCard({ session, campId, campName, campImage }: SessionCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [image, setImage] = useState<string | null>(campImage ?? null);

  // Check if session is saved on mount
  useEffect(() => {
    const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
    setIsSaved(savedSessions.includes(session.id));
  }, [session.id]);

  const formatDate = (dateString: string) => {
    // parseLocalDate, not new Date: a bare YYYY-MM-DD is parsed as UTC
    // midnight, which in Richmond renders as the day before.
    const date = parseLocalDate(dateString);
    if (!date) return dateString;
    return date.toLocaleDateString('en-US', {
      month: 'short',
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

  // "T, W, T, F": one letter a day, in week order. The full names go in the
  // title/aria-label, since T and S are ambiguous on their own.
  const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const sortedDays = (days?: string[]) =>
    (days ?? [])
      .map((d) => d.trim())
      .sort((a, b) => DAY_ORDER.indexOf(a.toLowerCase()) - DAY_ORDER.indexOf(b.toLowerCase()));
  const formatDaysOfWeek = (days?: string[]) =>
    sortedDays(days).map((d) => d.charAt(0).toUpperCase()).join(', ');

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session.id) return;

    const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
    let newSavedSessions: string[];

    if (isSaved) {
      // Unsave
      newSavedSessions = savedSessions.filter((id: string) => id !== session.id);
      setIsSaved(false);
      
      try {
        await fetch(`/api/sessions/${session.id}/save`, { method: 'DELETE' });
      } catch (err) {
        console.error('Error unsaving session:', err);
      }
    } else {
      // Save
      newSavedSessions = [...savedSessions, session.id];
      setIsSaved(true);
      
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
    <Link
      href={`/camps/${campId}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 overflow-hidden block relative"
    >
      {/* The camp's photo, as on its camp card: the quickest way to see which
          camp a session belongs to in a list of saved ones. */}
      <div className="relative h-[88px] w-full bg-gray-400">
        {image && (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover"
            onError={() => setImage(null)}
          />
        )}
        {/* Camp name in white on a dark gradient: which camp, at a glance. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        <p className="absolute inset-x-0 bottom-0 line-clamp-2 px-4 pb-2.5 text-sm font-semibold leading-snug text-white">
          {campName}
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveToggle}
        className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-all z-10"
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

      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {session.label || session.name || 'Session'}
        </h3>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Dates</p>
            <p className="text-sm text-gray-900">
              {formatDate(session.start_date)} - {formatDate(session.end_date)}
            </p>
          </div>

          {session.start_time && session.end_time && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Time</p>
              <p className="text-sm text-gray-900">
                {formatTime(session.start_time)} - {formatTime(session.end_time)}
              </p>
            </div>
          )}

          {/* Days and ages share a row: both short, both read together. */}
          {((session.days_of_week && session.days_of_week.length > 0) ||
            session.min_age != null ||
            session.max_age != null) && (
            <div className="grid grid-cols-2 gap-4">
              {session.days_of_week && session.days_of_week.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Days</p>
                  <p
                    className="text-sm text-gray-900"
                    title={sortedDays(session.days_of_week).join(', ')}
                    aria-label={sortedDays(session.days_of_week).join(', ')}
                  >
                    {formatDaysOfWeek(session.days_of_week)}
                  </p>
                </div>
              )}
              {(session.min_age != null || session.max_age != null) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Age Range</p>
                  <p className="text-sm text-gray-900">
                    Ages {session.min_age ?? '?'} - {session.max_age ?? '?'}
                  </p>
                </div>
              )}
            </div>
          )}

          {session.price != null && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Price</p>
              <p className="text-base font-semibold text-green-600">
                ${session.price.toFixed(2)}
              </p>
            </div>
          )}

          {session.capacity != null && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Capacity</p>
              <p className="text-sm text-gray-900">{session.capacity} spots</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}


