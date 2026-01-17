'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

interface Session {
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
  camp_id?: string;
  camps?: {
    id: string;
    name: string;
    location?: string;
  };
}

interface SessionsCalendarProps {
  sessions: Session[];
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Map full day names to abbreviations
const DAY_NAME_MAP: Record<string, number> = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6,
};

export default function SessionsCalendar({ sessions }: SessionsCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get all dates that should be highlighted
  const highlightedDates = useMemo(() => {
    const dates = new Set<string>();
    
    sessions.forEach(session => {
      if (!session.start_date || !session.end_date) {
        return;
      }
      
      const start = new Date(session.start_date);
      const end = new Date(session.end_date);
      
      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return;
      }
      
      // Get days of week as numbers if available
      const allowedDays = session.days_of_week?.map(day => {
        // Handle both full names and abbreviations
        const dayName = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
        if (dayName in DAY_NAME_MAP) {
          return DAY_NAME_MAP[dayName];
        }
        // Try abbreviation
        const abbrev = day.substring(0, 3);
        const dayIndex = DAYS_OF_WEEK.findIndex(d => d.toLowerCase() === abbrev.toLowerCase());
        return dayIndex >= 0 ? dayIndex : null;
      }).filter((day): day is number => day !== null) || null;
      
      // Iterate through each day in the date range
      const current = new Date(start);
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        
        // If days_of_week is specified, only include dates that match
        if (allowedDays && allowedDays.length > 0) {
          const dayOfWeek = current.getDay();
          if (allowedDays.includes(dayOfWeek)) {
            dates.add(dateStr);
          }
        } else {
          // Include all dates in the range
          dates.add(dateStr);
        }
        
        current.setDate(current.getDate() + 1);
      }
    });
    
    return dates;
  }, [sessions]);

  // Get the date range to display
  const dateRange = useMemo(() => {
    if (sessions.length === 0) {
      return null;
    }
    
    // Always try to use session date ranges directly first
    const allStartDates = sessions
      .map(s => {
        if (!s.start_date) return null;
        const d = new Date(s.start_date);
        return isNaN(d.getTime()) ? null : d;
      })
      .filter((d): d is Date => d !== null);
    const allEndDates = sessions
      .map(s => {
        if (!s.end_date) return null;
        const d = new Date(s.end_date);
        return isNaN(d.getTime()) ? null : d;
      })
      .filter((d): d is Date => d !== null);
    
    if (allStartDates.length === 0 || allEndDates.length === 0) {
      return null;
    }
    
    const minDate = new Date(Math.min(...allStartDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allEndDates.map(d => d.getTime())));
    
    return { minDate, maxDate };
  }, [sessions]);

  // Generate calendar months to display
  const calendarMonths = useMemo(() => {
    if (!dateRange) return [];
    
    const months: Array<{ year: number; month: number; days: Date[] }> = [];
    const current = new Date(dateRange.minDate);
    current.setDate(1); // Start of month
    
    const end = new Date(dateRange.maxDate);
    end.setMonth(end.getMonth() + 1); // Show one month after the last date
    
    while (current <= end) {
      const year = current.getFullYear();
      const month = current.getMonth();
      
      // Get first day of month and how many days
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startDayOfWeek = firstDay.getDay();
      
      // Generate all days for this month
      const days: Date[] = [];
      
      // Add empty cells for days before the first day of the month
      for (let i = 0; i < startDayOfWeek; i++) {
        days.push(new Date(0)); // Placeholder date, will be hidden
      }
      
      // Add all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        days.push(new Date(year, month, day));
      }
      
      months.push({ year, month, days });
      current.setMonth(month + 1);
    }
    
    return months;
  }, [dateRange]);

  // Get sessions for a specific date
  const getSessionsForDate = (dateStr: string): Session[] => {
    return sessions.filter(session => {
      if (!session.start_date || !session.end_date) return false;
      
      const start = new Date(session.start_date);
      const end = new Date(session.end_date);
      const targetDate = new Date(dateStr);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(targetDate.getTime())) {
        return false;
      }
      
      // Check if date is within range
      if (targetDate < start || targetDate > end) {
        return false;
      }
      
      // If days_of_week is specified, check if the date matches
      if (session.days_of_week && session.days_of_week.length > 0) {
        const allowedDays = session.days_of_week.map(day => {
          const dayName = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
          if (dayName in DAY_NAME_MAP) {
            return DAY_NAME_MAP[dayName];
          }
          const abbrev = day.substring(0, 3);
          const dayIndex = DAYS_OF_WEEK.findIndex(d => d.toLowerCase() === abbrev.toLowerCase());
          return dayIndex >= 0 ? dayIndex : null;
        }).filter((day): day is number => day !== null);
        
        if (allowedDays.length > 0) {
          const dayOfWeek = targetDate.getDay();
          return allowedDays.includes(dayOfWeek);
        }
      }
      
      return true;
    });
  };

  const handleDateClick = (dateStr: string) => {
    const dateSessions = getSessionsForDate(dateStr);
    if (dateSessions.length > 0) {
      setSelectedDate(dateStr);
      setIsModalOpen(true);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Calendar View</h3>
        <p className="text-gray-500 text-xs">No saved sessions to display</p>
      </div>
    );
  }

  if (!dateRange) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Calendar View</h3>
        <p className="text-gray-500 text-xs mb-2">
          Unable to display calendar. Please check that sessions have valid dates.
        </p>
        <div className="text-xs text-gray-600 mb-2">
          <p>Number of sessions: {sessions.length}</p>
          <p>Highlighted dates: {highlightedDates.size}</p>
        </div>
        <details className="mt-2">
          <summary className="text-xs text-gray-400 cursor-pointer">Debug info</summary>
          <pre className="text-xs mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-60">
            {JSON.stringify(sessions, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
      <h3 className="text-base font-semibold text-gray-900 mb-2">Calendar View</h3>
      <p className="text-xs text-gray-600 mb-4">
        Highlighted dates show when your saved sessions occur
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {calendarMonths.map(({ year, month, days }) => (
          <div key={`${year}-${month}`}>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">
              {MONTHS[month]} {year}
            </h4>
            
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DAYS_OF_WEEK.map(day => (
                <div
                  key={day}
                  className="text-center text-[10px] font-medium text-gray-500 py-0.5"
                >
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((date, idx) => {
                // Skip placeholder dates (padding from previous month)
                if (date.getTime() === 0 || date.getMonth() !== month) {
                  return <div key={idx} className="aspect-square" />;
                }
                
                const dateStr = date.toISOString().split('T')[0];
                const isHighlighted = highlightedDates.has(dateStr);
                const isToday = dateStr === new Date().toISOString().split('T')[0];
                const dateSessions = isHighlighted ? getSessionsForDate(dateStr) : [];
                
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => isHighlighted && handleDateClick(dateStr)}
                    disabled={!isHighlighted}
                    className={`
                      aspect-square flex items-center justify-center text-[10px] rounded
                      text-gray-900
                      ${isHighlighted
                        ? 'bg-blue-100 text-blue-900 font-semibold cursor-pointer hover:bg-blue-200'
                        : 'hover:bg-gray-100 cursor-default'
                      }
                      ${isToday ? 'ring-1 ring-blue-500' : ''}
                      transition-colors
                      disabled:opacity-100
                    `}
                    title={isHighlighted ? `${dateSessions.length} session${dateSessions.length === 1 ? '' : 's'} on ${date.toLocaleDateString()}` : undefined}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      {highlightedDates.size > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            <span className="inline-block w-3 h-3 bg-blue-100 rounded mr-1.5 align-middle"></span>
            <span className="font-medium">{highlightedDates.size}</span> session day{highlightedDates.size === 1 ? '' : 's'} saved
          </p>
        </div>
      )}

      {/* Modal for selected date */}
      {isModalOpen && selectedDate && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Sessions on {formatDate(selectedDate)}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {getSessionsForDate(selectedDate).length} session{getSessionsForDate(selectedDate).length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto p-4 flex-1">
              <div className="space-y-3">
                {getSessionsForDate(selectedDate).map((session) => {
                  const camp = session.camps;
                  return (
                    <div
                      key={session.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          {camp && (
                            <p className="text-xs text-gray-500 mb-1">Camp: {camp.name}</p>
                          )}
                          <h4 className="text-base font-semibold text-gray-900">
                            {session.label || session.name || 'Session'}
                          </h4>
                        </div>
                        {session.id && camp && (
                          <Link
                            href={`/camps/${camp.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium ml-4"
                            onClick={() => setIsModalOpen(false)}
                          >
                            View →
                          </Link>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {session.start_time && session.end_time && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Time</p>
                            <p className="text-gray-900">
                              {formatTime(session.start_time)} - {formatTime(session.end_time)}
                            </p>
                          </div>
                        )}

                        {session.days_of_week && session.days_of_week.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Days</p>
                            <p className="text-gray-900">{formatDaysOfWeek(session.days_of_week)}</p>
                          </div>
                        )}

                        {(session.min_age != null || session.max_age != null) && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Age Range</p>
                            <p className="text-gray-900">
                              Ages {session.min_age ?? '?'} - {session.max_age ?? '?'}
                            </p>
                          </div>
                        )}

                        {session.price != null && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Price</p>
                            <p className="text-gray-900 font-semibold text-green-600">
                              ${session.price.toFixed(2)}
                            </p>
                          </div>
                        )}

                        {session.capacity != null && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Capacity</p>
                            <p className="text-gray-900">{session.capacity} spots</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

