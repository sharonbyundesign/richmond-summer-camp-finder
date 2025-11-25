'use client';

import { useState, useEffect } from 'react';

interface FilterPanelProps {
  age: string;
  interests: string[];
  week: string;
  availableInterests: string[];
  availableWeeks: string[];
  onAgeChange: (age: string) => void;
  onInterestsChange: (interests: string[]) => void;
  onWeekChange: (week: string) => void;
}

export default function FilterPanel({
  age,
  interests,
  week,
  availableInterests,
  availableWeeks,
  onAgeChange,
  onInterestsChange,
  onWeekChange,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      onInterestsChange(interests.filter(i => i !== interest));
    } else {
      onInterestsChange([...interests, interest]);
    }
  };

  const formatWeekLabel = (weekDate: string) => {
    const date = new Date(weekDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Filters</h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="sm:hidden text-gray-600 hover:text-gray-900"
          aria-label="Toggle filters"
        >
          <svg
            className={`w-6 h-6 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className={`${isOpen ? 'block' : 'hidden'} sm:block space-y-6`}>
        {/* Age Filter */}
        <div>
          <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
            Child's Age
          </label>
          <input
            type="number"
            id="age"
            min="0"
            max="18"
            value={age}
            onChange={(e) => onAgeChange(e.target.value)}
            placeholder="Enter age"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Interests Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Interests
          </label>
          <div className="flex flex-wrap gap-2">
            {availableInterests.map((interest) => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  interests.includes(interest)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
          {interests.length > 0 && (
            <button
              onClick={() => onInterestsChange([])}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Week Filter */}
        <div>
          <label htmlFor="week" className="block text-sm font-medium text-gray-700 mb-2">
            Week
          </label>
          <select
            id="week"
            value={week}
            onChange={(e) => onWeekChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All weeks</option>
            {availableWeeks.map((weekDate) => (
              <option key={weekDate} value={weekDate}>
                {formatWeekLabel(weekDate)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}


