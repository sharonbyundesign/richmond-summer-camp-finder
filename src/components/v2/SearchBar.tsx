'use client';

import { useEffect, useRef, useState } from 'react';
import { RADIUS_OPTIONS, type PillState } from '@/lib/v2/usePillState';
import { groupWeeksByMonth, type WeekOption } from '@/lib/v2/weeks';
import {
  PRICE_BRACKET_OPTIONS,
  SESSION_TYPE_OPTIONS,
  type Filters,
  type PriceBracket,
  type SessionType,
} from '@/lib/campFilters';
import { categoryIcon } from '@/lib/interest-categories';
import { capture } from '@/lib/analytics';

const SELECTABLE_AGES = Array.from({ length: 17 }, (_, i) => i + 2); // 2–18

type ChipId = 'age' | 'weeks' | 'location' | 'daytype' | 'price' | 'interests';

/** The three that lived in the "More filters" modal before it was retired. */
const FORMERLY_IN_MODAL: ChipId[] = ['daytype', 'price', 'interests'];

interface SearchBarProps {
  state: PillState;
  onChange: (next: PillState) => void;
  weekOptions: WeekOption[];
  zipStatus: 'idle' | 'loading' | 'ok' | 'notfound';
  query: string;
  onQueryChange: (query: string) => void;
  filters: Filters;
  onFiltersChange: (patch: Partial<Filters>) => void;
  availableInterests: string[];
  onClearAll: () => void;
  /** Show the "Registration open" switch: only once some camp has a date. */
  showRegistrationFilter?: boolean;
}

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * Search by name, then a row of filters that are each one click away.
 *
 * This replaces the segmented age | weeks | zip pill plus a "More filters"
 * modal. In the user test, parents went looking for price and full/half day
 * even while those were behind the modal — so nothing is behind a modal now.
 * Every filter is its own chip (the Mobbin pattern): grey with a chevron when
 * unset, dark with its value and an × when set.
 */
export default function SearchBar({
  state,
  onChange,
  weekOptions,
  zipStatus,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  availableInterests,
  onClearAll,
  showRegistrationFilter = false,
}: SearchBarProps) {
  const [open, setOpen] = useState<ChipId | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const toggleChip = (chip: ChipId) => {
    const next = open === chip ? null : chip;
    // Keeps the more_filters_opened series continuous now that those three
    // filters are chips: it fires for the same filters it always did.
    if (next && FORMERLY_IN_MODAL.includes(next)) {
      capture('more_filters_opened', { chip: next });
    }
    setOpen(next);
  };

  // --- summaries shown on a set chip --------------------------------------
  const selectedWeekLabels = weekOptions.filter((w) => state.weeks.includes(w.key)).map((w) => w.label);
  const typeLabels = SESSION_TYPE_OPTIONS.filter((o) => filters.sessionTypes.includes(o.value)).map((o) => o.label);
  const priceLabels = PRICE_BRACKET_OPTIONS.filter((o) => filters.priceBrackets.includes(o.value)).map((o) => o.label);

  const summarize = (labels: string[]) =>
    labels.length === 0 ? null : labels.length === 1 ? labels[0] : `${labels[0]} +${labels.length - 1}`;

  const summaries: Record<ChipId, string | null> = {
    age: state.ages.length ? `Age ${state.ages.join(', ')}` : null,
    weeks: summarize(selectedWeekLabels),
    location: state.zip.length === 5 ? `${state.zip} · ${state.radius} mi` : null,
    daytype: summarize(typeLabels),
    price: summarize(priceLabels),
    interests: summarize(filters.interests),
  };

  const clearers: Record<ChipId, () => void> = {
    age: () => onChange({ ...state, ages: [], matchAllAges: false }),
    weeks: () => onChange({ ...state, weeks: [] }),
    location: () => onChange({ ...state, zip: '' }),
    daytype: () => onFiltersChange({ sessionTypes: [] }),
    price: () => onFiltersChange({ priceBrackets: [] }),
    interests: () => onFiltersChange({ interests: [] }),
  };

  const anySet =
    Object.values(summaries).some(Boolean) || query.trim().length > 0 || filters.registrationOpen;

  // --- handlers ------------------------------------------------------------
  const toggleAge = (age: number) => {
    const adding = !state.ages.includes(age);
    const ages = adding ? [...state.ages, age].sort((a, b) => a - b) : state.ages.filter((v) => v !== age);
    onChange({ ...state, ages });
    capture('age_filter_changed', { age, action: adding ? 'added' : 'removed', total_ages: ages.length });
  };

  const toggleWeek = (key: string) => {
    const adding = !state.weeks.includes(key);
    const weeks = adding ? [...state.weeks, key] : state.weeks.filter((v) => v !== key);
    onChange({ ...state, weeks });
    capture('week_filter_changed', { week_key: key, action: adding ? 'added' : 'removed', total_weeks: weeks.length });
  };

  const toggleInterest = (interest: string) => {
    const adding = !filters.interests.includes(interest);
    onFiltersChange({ interests: toggle(filters.interests, interest) });
    capture('interest_filter_toggled', { interest, action: adding ? 'added' : 'removed' });
  };

  const monthGroups = groupWeeksByMonth(weekOptions);

  const chips: Array<{ id: ChipId; label: string }> = [
    { id: 'age', label: 'Age' },
    { id: 'weeks', label: 'Weeks' },
    { id: 'location', label: 'Location' },
    { id: 'daytype', label: 'Full / half day' },
    { id: 'price', label: 'Price' },
    { id: 'interests', label: 'Interests' },
  ];

  return (
    <div ref={containerRef} className="relative">
      <label className="relative block">
        <span className="sr-only">Search camps</span>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Camp, place or activity"
          className="h-12 w-full rounded-full border-0 bg-gray-100 pl-12 pr-4 text-base text-gray-900 placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-blue-500"
        />
      </label>

      {/* Scrolls sideways on a phone rather than wrapping into a block of chips
          that pushes the results off the first screen. */}
      <div className="-mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {chips.map(({ id, label }) => {
          const summary = summaries[id];
          const isOpen = open === id;
          return summary ? (
            <div
              key={id}
              className="inline-flex shrink-0 items-center rounded-full border-2 border-gray-900 bg-white text-sm font-semibold text-gray-900"
            >
              <button
                type="button"
                onClick={() => toggleChip(id)}
                aria-expanded={isOpen}
                className="py-1.5 pl-3.5 pr-1.5"
              >
                {summary}
              </button>
              <button
                type="button"
                onClick={clearers[id]}
                aria-label={`Clear ${label}`}
                className="mr-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white hover:bg-gray-700"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              key={id}
              type="button"
              onClick={() => toggleChip(id)}
              aria-expanded={isOpen}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isOpen ? 'border-gray-900 text-gray-900' : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {label}
              <svg
                aria-hidden="true"
                className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          );
        })}

        {/* A switch, not a menu: on or off. Shown in the set style when on.
            Hidden until some camp has a registration date, unless it's on. */}
        {(showRegistrationFilter || filters.registrationOpen) && (
        <button
          type="button"
          aria-pressed={filters.registrationOpen}
          onClick={() => {
            const next = !filters.registrationOpen;
            onFiltersChange({ registrationOpen: next });
            capture('registration_open_filter_toggled', { action: next ? 'added' : 'removed' });
          }}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
            filters.registrationOpen
              ? 'border-2 border-gray-900 bg-white font-semibold text-gray-900'
              : 'border border-gray-300 font-medium text-gray-700 hover:border-gray-400'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${filters.registrationOpen ? 'bg-green-600' : 'bg-green-500/70'}`}
          />
          Registration open
        </button>
        )}

        {anySet && (
          <button
            type="button"
            onClick={() => {
              onClearAll();
              setOpen(null);
            }}
            className="shrink-0 px-1 text-sm font-medium text-gray-600 underline underline-offset-2 hover:text-gray-900"
          >
            Clear all
          </button>
        )}
      </div>

      {open === 'age' && (
        <Popover>
          <p className="mb-3 text-sm font-medium text-gray-900">Who&apos;s going?</p>
          {state.ages.length === 0 && (
            <p className="mb-4 text-sm text-gray-500">No ages selected — showing camps for all ages.</p>
          )}
          {/* Only meaningful with two or more kids: adding a second age normally WIDENS
              the results; this narrows them to camps that serve every kid. */}
          {state.ages.length > 1 && (
            <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-lg bg-gray-50 p-3">
              <input
                type="checkbox"
                checked={state.matchAllAges}
                onChange={(event) => onChange({ ...state, matchAllAges: event.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                <span className="font-medium">Only camps that fit all {state.ages.length} kids</span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  Off: camps for {state.ages.join(' or ')}. On: camps for {state.ages.join(' and ')}.
                </span>
              </span>
            </label>
          )}
          <div className="grid grid-cols-6 gap-2">
            {SELECTABLE_AGES.map((age) => (
              <button
                key={age}
                type="button"
                onClick={() => toggleAge(age)}
                aria-pressed={state.ages.includes(age)}
                className={`h-9 rounded-full border text-sm font-medium transition-colors ${
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
          <p className="mb-3 text-sm font-medium text-gray-900">Which weeks?</p>
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
                          aria-pressed={selected}
                          title={empty ? 'No camps have sessions this week yet' : `${week.campCount} camps`}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                            selected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : empty
                                ? 'border-gray-200 text-gray-400 hover:border-gray-300'
                                : 'border-gray-200 text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          {week.label}
                          <span className={`text-xs ${selected ? 'text-white/75' : empty ? 'text-gray-400' : 'text-gray-500'}`}>
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

      {open === 'location' && (
        <Popover>
          <p className="mb-3 text-sm font-medium text-gray-900">Where?</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="bar-zip" className="mb-1 block text-xs text-gray-600">
                Zip code
              </label>
              <input
                id="bar-zip"
                type="text"
                inputMode="numeric"
                placeholder="23220"
                value={state.zip}
                onChange={(event) => {
                  const zip = event.target.value.replace(/\D/g, '').slice(0, 5);
                  onChange({ ...state, zip });
                  if (zip.length === 5) capture('zip_filter_applied', { radius_miles: state.radius });
                }}
                className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-32">
              <label htmlFor="bar-radius" className="mb-1 block text-xs text-gray-600">
                Radius
              </label>
              <select
                id="bar-radius"
                value={state.radius}
                onChange={(event) => {
                  const radius = Number(event.target.value);
                  onChange({ ...state, radius });
                  capture('radius_changed', { radius_miles: radius, zip_active: state.zip.length === 5 });
                }}
                className="select-pill w-full rounded-full border border-gray-300 bg-white py-2 pl-4 pr-10 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
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

      {open === 'daytype' && (
        <Popover>
          <p className="mb-3 text-sm font-medium text-gray-900">Full or half day?</p>
          <OptionList<SessionType>
            options={SESSION_TYPE_OPTIONS}
            selected={filters.sessionTypes}
            onToggle={(value) => {
              const next = toggle(filters.sessionTypes, value);
              onFiltersChange({ sessionTypes: next });
              capture('day_type_filter_toggled', {
                day_type: value,
                action: next.includes(value) ? 'added' : 'removed',
                total_selected: next.length,
              });
            }}
          />
        </Popover>
      )}

      {open === 'price' && (
        <Popover>
          <p className="mb-3 text-sm font-medium text-gray-900">Price per week</p>
          <OptionList<PriceBracket>
            options={PRICE_BRACKET_OPTIONS}
            selected={filters.priceBrackets}
            onToggle={(value) => {
              const next = toggle(filters.priceBrackets, value);
              onFiltersChange({ priceBrackets: next });
              capture('price_filter_toggled', {
                price_bracket: value,
                action: next.includes(value) ? 'added' : 'removed',
                total_selected: next.length,
              });
            }}
          />
          {/* Most camps haven't posted prices yet, so a price filter hides far
              more than a parent would guess. Saying so keeps "12 camps" from
              reading as "only 12 affordable camps in Richmond". */}
          <p className="mt-3 text-xs text-gray-500">
            Camps that haven&apos;t posted a price are hidden while this is on.
          </p>
        </Popover>
      )}

      {open === 'interests' && (
        <Popover>
          <p className="mb-3 text-sm font-medium text-gray-900">Interests</p>
          <div className="flex flex-wrap gap-2">
            {availableInterests.map((interest) => {
              const selected = filters.interests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selected
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <span aria-hidden="true">{categoryIcon(interest)}</span>
                  {interest}
                </button>
              );
            })}
          </div>
        </Popover>
      )}
    </div>
  );
}

function OptionList<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ value: T; label: string }>;
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            aria-pressed={on}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Popover({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:right-auto sm:min-w-[26rem]">
      {children}
    </div>
  );
}
