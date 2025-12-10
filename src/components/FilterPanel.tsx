'use client';

interface FilterPanelProps {
  // Child selection
  selectedChildId?: string | null;
  childrenList?: Array<{ id: number; name: string; age: number }>;
  
  // Age (fallback if no child selected)
  age: string;
  
  // Filters
  interests: string[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  daysOfWeek?: string[];
  timeOfDay?: 'morning' | 'afternoon' | 'full-day' | '';
  zipcode?: string;
  maxDistance?: string;
  minPrice?: string;
  maxPrice?: string;
  hideConflicts?: boolean;
  
  // Available options
  availableInterests: string[];
  
  // Handlers
  onChildChange?: (childId: string | null) => void;
  onAgeChange: (age: string) => void;
  onInterestsChange: (interests: string[]) => void;
  onDateRangeStartChange?: (date: string) => void;
  onDateRangeEndChange?: (date: string) => void;
  onDaysOfWeekChange?: (days: string[]) => void;
  onTimeOfDayChange?: (time: 'morning' | 'afternoon' | 'full-day' | '') => void;
  onZipcodeChange?: (zip: string) => void;
  onMaxDistanceChange?: (distance: string) => void;
  onMinPriceChange?: (price: string) => void;
  onMaxPriceChange?: (price: string) => void;
  onHideConflictsChange?: (hide: boolean) => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function FilterPanel({
  selectedChildId,
  childrenList = [],
  age,
  interests,
  dateRangeStart,
  dateRangeEnd,
  daysOfWeek = [],
  timeOfDay = '',
  zipcode,
  maxDistance,
  minPrice,
  maxPrice,
  hideConflicts = false,
  availableInterests,
  onChildChange,
  onAgeChange,
  onInterestsChange,
  onDateRangeStartChange,
  onDateRangeEndChange,
  onDaysOfWeekChange,
  onTimeOfDayChange,
  onZipcodeChange,
  onMaxDistanceChange,
  onMinPriceChange,
  onMaxPriceChange,
  onHideConflictsChange,
}: FilterPanelProps) {

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      onInterestsChange(interests.filter(i => i !== interest));
    } else {
      onInterestsChange([...interests, interest]);
    }
  };

  const toggleDayOfWeek = (day: string) => {
    if (!onDaysOfWeekChange) return;
    if (daysOfWeek.includes(day)) {
      onDaysOfWeekChange(daysOfWeek.filter(d => d !== day));
    } else {
      onDaysOfWeekChange([...daysOfWeek, day]);
    }
  };

  const selectedChild = childrenList.find(c => c.id.toString() === selectedChildId);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-200 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Filters</h2>

      <div className="space-y-6">
        {/* Child Selector */}
        {onChildChange && childrenList.length > 0 && (
          <div>
            <label htmlFor="child" className="block text-sm font-medium text-gray-700 mb-2">
              Select Child
            </label>
            <select
              id="child"
              value={selectedChildId || ''}
              onChange={(e) => {
                const value = e.target.value;
                onChildChange(value === '' ? null : value);
                // Auto-fill age if child is selected
                if (value && childrenList.length > 0) {
                  const child = childrenList.find(c => c.id.toString() === value);
                  if (child) {
                    onAgeChange(child.age.toString());
                  }
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">No child selected</option>
              {childrenList.map((child) => (
                <option key={child.id} value={child.id.toString()}>
                  {child.name} (Age {child.age})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Age Filter (shown if no child selected or always) */}
        <div>
          <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
            {selectedChild ? `Child's Age (${selectedChild.name})` : "Child's Age"}
          </label>
          <input
            type="number"
            id="age"
            min="0"
            max="18"
            value={selectedChild ? selectedChild.age.toString() : age}
            onChange={(e) => onAgeChange(e.target.value)}
            placeholder="Enter age"
            disabled={!!selectedChild}
            className={`w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              selectedChild ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
          />
          {selectedChild && (
            <p className="mt-1 text-xs text-gray-500">Age is set from selected child</p>
          )}
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

        {/* Date Range Filter */}
        {onDateRangeStartChange && onDateRangeEndChange && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="space-y-2">
              <div>
                <label htmlFor="dateStart" className="block text-xs text-gray-600 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  id="dateStart"
                  value={dateRangeStart || ''}
                  onChange={(e) => onDateRangeStartChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="dateEnd" className="block text-xs text-gray-600 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  id="dateEnd"
                  value={dateRangeEnd || ''}
                  onChange={(e) => onDateRangeEndChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Days of Week Filter */}
        {onDaysOfWeekChange && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Days of Week
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDayOfWeek(day)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    daysOfWeek.includes(day)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
            {daysOfWeek.length > 0 && (
              <button
                onClick={() => onDaysOfWeekChange([])}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Time of Day Filter */}
        {onTimeOfDayChange && (
          <div>
            <label htmlFor="timeOfDay" className="block text-sm font-medium text-gray-700 mb-2">
              Time of Day
            </label>
            <select
              id="timeOfDay"
              value={timeOfDay}
              onChange={(e) => onTimeOfDayChange(e.target.value as 'morning' | 'afternoon' | 'full-day' | '')}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Any time</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="full-day">Full Day</option>
            </select>
          </div>
        )}

        {/* Distance Filter */}
        {onZipcodeChange && onMaxDistanceChange && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Distance from Zip Code
            </label>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Zip code"
                value={zipcode || ''}
                onChange={(e) => onZipcodeChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={5}
              />
              <input
                type="number"
                placeholder="Max distance (miles)"
                value={maxDistance || ''}
                onChange={(e) => onMaxDistanceChange(e.target.value)}
                min="0"
                step="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Price Range Filter */}
        {(onMinPriceChange || onMaxPriceChange) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price Range
            </label>
            <div className="space-y-2">
              {onMinPriceChange && (
                <input
                  type="number"
                  placeholder="Min price ($)"
                  value={minPrice || ''}
                  onChange={(e) => onMinPriceChange(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
              {onMaxPriceChange && (
                <input
                  type="number"
                  placeholder="Max price ($)"
                  value={maxPrice || ''}
                  onChange={(e) => onMaxPriceChange(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>
          </div>
        )}

        {/* Hide Conflicts Checkbox */}
        {onHideConflictsChange && selectedChildId && (
          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideConflicts}
                onChange={(e) => onHideConflictsChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Hide conflicts with saved schedule
              </span>
            </label>
            <p className="mt-1 text-xs text-gray-500">
              Exclude camps that conflict with {selectedChild?.name || 'selected child'}&apos;s saved sessions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
