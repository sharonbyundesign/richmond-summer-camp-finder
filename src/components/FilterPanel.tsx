'use client';

import { useMemo, useState } from 'react';
import { categoryIcon } from '@/lib/interest-categories';
import {
  Filters,
  SessionType,
  PriceBracket,
  SESSION_TYPE_OPTIONS,
  PRICE_BRACKET_OPTIONS,
  RADIUS_OPTIONS,
  weekMonthName,
  isWeekPast,
} from '@/lib/campFilters';

interface WeekOption {
  weekStart: string;
  label: string;
}

interface FilterPanelProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  availableInterests: string[];
  weeks: WeekOption[];
  // Section visibility. Default true so v1 is unaffected; v2 hides age/weeks/
  // distance here because those live in its search pill instead.
  showAges?: boolean;
  showWeeks?: boolean;
  showDistance?: boolean;
}

// Shared pill styling for multi-select chips, matching the interest pills.
function pillClass(selected: boolean): string {
  return `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
    selected
      ? 'border-blue-600 bg-blue-600 text-white'
      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
  }`;
}

// Toggle a value in a multi-select array (OR within a section).
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function FilterPanel({
  filters,
  onChange,
  availableInterests,
  weeks,
  showAges = true,
  showWeeks = true,
  showDistance = true,
}: FilterPanelProps) {
  const [ageInput, setAgeInput] = useState('');

  // Group weeks into month sections (weeks arrive already sorted ascending).
  const monthGroups = useMemo(() => {
    const groups: Array<{ month: string; weeks: WeekOption[] }> = [];
    for (const week of weeks) {
      const month = weekMonthName(week.weekStart);
      const last = groups[groups.length - 1];
      if (last && last.month === month) {
        last.weeks.push(week);
      } else {
        groups.push({ month, weeks: [week] });
      }
    }
    return groups;
  }, [weeks]);

  const addAge = () => {
    const age = parseInt(ageInput, 10);
    if (Number.isNaN(age) || age < 0 || age > 18) return;
    if (filters.ages.includes(age)) {
      setAgeInput('');
      return;
    }
    onChange({ ages: [...filters.ages, age].sort((a, b) => a - b) });
    setAgeInput('');
  };

  const removeAge = (age: number) => {
    onChange({ ages: filters.ages.filter((a) => a !== age) });
  };

  const toggleInterest = (interest: string) => {
    onChange({ interests: toggle(filters.interests, interest) });
  };

  const toggleWeek = (weekStart: string) => {
    onChange({ weeks: toggle(filters.weeks, weekStart) });
  };

  const toggleSessionType = (type: SessionType) => {
    onChange({ sessionTypes: toggle(filters.sessionTypes, type) });
  };

  const togglePrice = (bracket: PriceBracket) => {
    onChange({ priceBrackets: toggle(filters.priceBrackets, bracket) });
  };

  return (
    <div className="space-y-6">
      {/* Kids' ages */}
      {showAges && (
      <div>
        <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
          Kids&apos; ages
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            id="age"
            min="0"
            max="18"
            value={ageInput}
            onChange={(e) => setAgeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addAge();
              }
            }}
            placeholder="Age"
            className="w-24 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={addAge}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Add age
          </button>
        </div>
        {filters.ages.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {filters.ages.map((age) => (
              <span
                key={age}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-sm font-medium text-blue-700"
              >
                Age {age}
                <button
                  type="button"
                  onClick={() => removeAge(age)}
                  aria-label={`Remove age ${age}`}
                  className="text-blue-500 hover:text-blue-800"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
        {filters.ages.length > 0 && (
          <label className="flex items-center space-x-2 cursor-pointer mt-3">
            <input
              type="checkbox"
              checked={filters.matchAllAges}
              onChange={(e) => onChange({ matchAllAges: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Only show camps that fit all ages</span>
          </label>
        )}
      </div>
      )}

      {/* Interests (unchanged) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Interests
            {filters.interests.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                {filters.interests.length}
              </span>
            )}
          </label>
          {filters.interests.length > 0 && (
            <button
              onClick={() => onChange({ interests: [] })}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {availableInterests.map((interest) => {
            const selected = filters.interests.includes(interest);
            return (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                aria-pressed={selected}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span aria-hidden="true">{categoryIcon(interest)}</span>
                {interest}
              </button>
            );
          })}
        </div>
      </div>

      {/* Weeks */}
      {showWeeks && (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Weeks
            {filters.weeks.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                {filters.weeks.length}
              </span>
            )}
          </label>
          {filters.weeks.length > 0 && (
            <button
              onClick={() => onChange({ weeks: [] })}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Clear
            </button>
          )}
        </div>
        {weeks.length === 0 ? (
          <p className="text-sm text-gray-400">Loading weeks…</p>
        ) : (
          <div className="space-y-4">
            {monthGroups.map((group) => (
              <div key={group.month}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  {group.month}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {group.weeks.map((week) => {
                    const selected = filters.weeks.includes(week.weekStart);
                    const past = isWeekPast(week.weekStart);
                    return (
                      <button
                        key={week.weekStart}
                        onClick={() => toggleWeek(week.weekStart)}
                        disabled={past}
                        aria-pressed={selected}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                          past
                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                            : selected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {week.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Session type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Session type</label>
        <div className="flex flex-wrap gap-2">
          {SESSION_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleSessionType(option.value)}
              aria-pressed={filters.sessionTypes.includes(option.value)}
              className={pillClass(filters.sessionTypes.includes(option.value))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price per week */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Price per week</label>
        <div className="flex flex-wrap gap-2">
          {PRICE_BRACKET_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => togglePrice(option.value)}
              aria-pressed={filters.priceBrackets.includes(option.value)}
              className={pillClass(filters.priceBrackets.includes(option.value))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Distance */}
      {showDistance && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Distance</label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Zip code"
            value={filters.zip}
            onChange={(e) => onChange({ zip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
            maxLength={5}
            className="w-32 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <select
            value={filters.radius}
            onChange={(e) => onChange({ radius: parseInt(e.target.value, 10) })}
            aria-label="Search radius"
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} mi
              </option>
            ))}
          </select>
        </div>
      </div>
      )}
    </div>
  );
}
