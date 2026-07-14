'use client';

import { useEffect, useRef, useState } from 'react';
import { RADIUS_OPTIONS, type PillState } from '@/lib/v2/usePillState';
import { groupWeeksByMonth, type WeekOption } from '@/lib/v2/weeks';

const SELECTABLE_AGES = Array.from({ length: 17 }, (_, i) => i + 2); // 2–18

type Segment = 'age' | 'weeks' | 'zip' | null;

interface SearchPillProps {
  state: PillState;
  onChange: (next: PillState) => void;
  weekOptions: WeekOption[];
  zipStatus: 'idle' | 'loading' | 'ok' | 'notfound';
  onSearch: () => void;
  /** Fires only when a segment opens, not when it closes. */
  onSegmentOpen?: (segment: 'age' | 'weeks' | 'zip') => void;
}

export default function SearchPill({
  state,
  onChange,
  weekOptions,
  zipStatus,
  onSearch,
  onSegmentOpen,
}: SearchPillProps) {
  const [open, setOpen] = useState<Segment>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleSegment = (segment: 'age' | 'weeks' | 'zip') => {
    const next = open === segment ? null : segment;
    if (next) onSegmentOpen?.(next);
    setOpen(next);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggleAge = (age: number) => {
    const ages = state.ages.includes(age)
      ? state.ages.filter((value) => value !== age)
      : [...state.ages, age].sort((a, b) => a - b);
    onChange({ ...state, ages });
  };

  const toggleWeek = (key: string) => {
    const weeks = state.weeks.includes(key)
      ? state.weeks.filter((value) => value !== key)
      : [...state.weeks, key];
    onChange({ ...state, weeks });
  };

  const selectedWeekLabels = weekOptions
    .filter((week) => state.weeks.includes(week.key))
    .map((week) => week.label);

  const ageSummary = state.ages.length > 0 ? state.ages.join(', ') : 'Any age';
  const weekSummary =
    selectedWeekLabels.length === 0
      ? 'Any week'
      : selectedWeekLabels.length === 1
        ? selectedWeekLabels[0]
        : `${selectedWeekLabels.length} weeks`;
  const zipSummary = state.zip ? `${state.zip} · ${state.radius} mi` : 'Anywhere';

  const monthGroups = groupWeeksByMonth(weekOptions);

  return (
    <div ref={containerRef} className="relative">
      {/* Below sm the three segments stack: side by side at 375px they get ~56px of text
          each after padding, which truncates "Any week" into nonsense. */}
      <div className="flex flex-col rounded-2xl border border-gray-300 bg-white shadow-sm transition-shadow focus-within:shadow-md hover:shadow-md sm:flex-row sm:items-stretch sm:rounded-full">
        <Segment
          label="Age"
          value={ageSummary}
          active={open === 'age'}
          filled={state.ages.length > 0}
          onClick={() => toggleSegment('age')}
        />
        <Divider />
        <Segment
          label="Weeks"
          value={weekSummary}
          active={open === 'weeks'}
          filled={state.weeks.length > 0}
          onClick={() => toggleSegment('weeks')}
        />
        <Divider />
        <Segment
          label="Zip code"
          value={zipSummary}
          active={open === 'zip'}
          filled={state.zip.length === 5}
          onClick={() => toggleSegment('zip')}
        />

        <div className="p-3 sm:flex sm:items-center sm:p-0 sm:pr-2">
          <button
            type="button"
            onClick={() => {
              setOpen(null);
              onSearch();
            }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:w-11 sm:gap-0"
            aria-label="Search camps"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z"
              />
            </svg>
            <span className="sm:hidden">Search camps</span>
          </button>
        </div>
      </div>

      {open === 'age' && (
        <Popover>
          <p className="mb-3 text-sm font-medium text-gray-900">Who&apos;s going?</p>

          {state.ages.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {state.ages.map((age) => (
                <span
                  key={age}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
                >
                  {age}
                  <button
                    type="button"
                    onClick={() => toggleAge(age)}
                    className="text-white/80 hover:text-white"
                    aria-label={`Remove age ${age}`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-gray-500">No ages selected — showing camps for all ages.</p>
          )}

          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Add age</p>
          <div className="grid grid-cols-6 gap-2">
            {SELECTABLE_AGES.map((age) => (
              <button
                key={age}
                type="button"
                onClick={() => toggleAge(age)}
                className={`h-9 rounded-lg border text-sm font-medium transition-colors ${
                  state.ages.includes(age)
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-400'
                }`}
              >
                {age}
              </button>
            ))}
          </div>
        </Popover>
      )}

      {open === 'weeks' && (
        <Popover>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">Which weeks?</p>
            {state.weeks.length > 0 && (
              <button
                type="button"
                onClick={() => onChange({ ...state, weeks: [] })}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                Clear
              </button>
            )}
          </div>

          {monthGroups.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming weeks available.</p>
          ) : (
            <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
              {monthGroups.map((group) => (
                <div key={group.month}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{group.month}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.weeks.map((week) => {
                      const selected = state.weeks.includes(week.key);
                      const empty = week.campCount === 0;

                      return (
                        <button
                          key={week.key}
                          type="button"
                          onClick={() => toggleWeek(week.key)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                            selected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : empty
                                ? 'border-gray-200 text-gray-400 hover:border-gray-300'
                                : 'border-gray-200 text-gray-700 hover:border-gray-400'
                          }`}
                          title={empty ? 'No camps have sessions this week' : `${week.campCount} camps`}
                        >
                          {week.label}
                          <span
                            className={`text-xs ${
                              selected ? 'text-white/75' : empty ? 'text-gray-400' : 'text-gray-500'
                            }`}
                          >
                            {week.campCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Popover>
      )}

      {open === 'zip' && (
        <Popover>
          <p className="mb-3 text-sm font-medium text-gray-900">Where?</p>

          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="pill-zip" className="mb-1 block text-xs text-gray-600">
                Zip code
              </label>
              <input
                id="pill-zip"
                type="text"
                inputMode="numeric"
                placeholder="23220"
                value={state.zip}
                onChange={(event) =>
                  onChange({ ...state, zip: event.target.value.replace(/\D/g, '').slice(0, 5) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="w-32">
              <label htmlFor="pill-radius" className="mb-1 block text-xs text-gray-600">
                Radius
              </label>
              <select
                id="pill-radius"
                value={state.radius}
                onChange={(event) => onChange({ ...state, radius: Number(event.target.value) })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                {RADIUS_OPTIONS.map((miles) => (
                  <option key={miles} value={miles}>
                    {miles} mi
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            {state.zip.length > 0 && state.zip.length < 5 && 'Enter all 5 digits.'}
            {zipStatus === 'loading' && 'Locating zip code…'}
            {zipStatus === 'notfound' && <span className="text-red-600">We couldn&apos;t find that zip code.</span>}
            {zipStatus === 'ok' && `Showing camps within ${state.radius} miles.`}
            {zipStatus === 'idle' && state.zip.length === 0 && 'Leave blank to search everywhere.'}
          </p>
        </Popover>
      )}
    </div>
  );
}

function Divider() {
  // Horizontal rule when stacked, vertical hairline when the pill is a row.
  return <div className="mx-5 h-px shrink-0 bg-gray-200 sm:mx-0 sm:my-2 sm:h-auto sm:w-px" />;
}

function Popover({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:right-auto sm:min-w-[26rem]">
      {children}
    </div>
  );
}

function Segment({
  label,
  value,
  active,
  filled,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  filled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-start justify-center rounded-2xl px-5 py-2.5 text-left transition-colors sm:min-h-0 sm:rounded-full ${
        active ? 'bg-gray-100' : 'hover:bg-gray-50'
      }`}
    >
      <span className="text-xs font-semibold text-gray-900">{label}</span>
      <span className={`w-full truncate text-sm ${filled ? 'text-gray-900' : 'text-gray-500'}`}>{value}</span>
    </button>
  );
}
