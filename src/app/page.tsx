'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import CampCard from '@/components/CampCard';
import SavedLink from '@/components/SavedLink';
import CampCardSkeleton from '@/components/CampCardSkeleton';
import UpdatesSignup from '@/components/UpdatesSignup';
import SearchBar from '@/components/v2/SearchBar';
import type { MapMarker } from '@/components/v2/MapPanel';
import { usePillState, EMPTY_PILL } from '@/lib/v2/usePillState';
import { useFilterState } from '@/lib/v2/useFilterState';
import { buildWeekOptions, campMatchesAges, campMatchesWeeks, cheapestFittingWeeklyPrice } from '@/lib/v2/weeks';
import { lookupZip, campSites, nearestSite, haversineMiles } from '@/lib/v2/geo';
import {
  emptyFilters,
  filtersToSearchParams,
  countActiveFilters,
  type Filters,
} from '@/lib/campFilters';
import type { Camp } from '@/types/camp';
import RecommendedSection from '@/components/v2/RecommendedSection';
import { capture, REC_FLAG } from '@/lib/analytics';
import { useFeatureFlag } from '@/lib/useFeatureFlag';

const MapPanel = dynamic(() => import('@/components/v2/MapPanel'), { ssr: false });

type SortMode = 'distance' | 'az' | 'price' | 'updated';

const DESKTOP_QUERY = '(min-width: 768px)';

const SPLIT_KEY = 'scouty:v2:split';
const SPLIT_DEFAULT = 58;
const SPLIT_MIN = 35;
const SPLIT_MAX = 72;

const clampSplit = (value: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));

const CARD_MIN_W = 260;
const CARD_GAP = 20; // gap-5
const CARD_MAX_COLS = 4;

/**
 * Card columns track the list column's real width, not the viewport — the split is
 * draggable, so a breakpoint can't know how much room the cards actually have.
 */
function useCardColumns(ref: React.RefObject<HTMLElement>) {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const fits = Math.floor((width + CARD_GAP) / (CARD_MIN_W + CARD_GAP));
      setColumns(Math.min(CARD_MAX_COLS, Math.max(1, fits)));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}

/** List/map split as a percentage of the row, persisted like the rest of the session state. */
function useSplit() {
  const [split, setSplit] = useState(SPLIT_DEFAULT);

  useEffect(() => {
    const raw = Number(localStorage.getItem(SPLIT_KEY));
    if (Number.isFinite(raw) && raw > 0) setSplit(clampSplit(raw));
  }, []);

  const commit = useCallback((value: number) => {
    const next = clampSplit(value);
    setSplit(next);
    try {
      localStorage.setItem(SPLIT_KEY, String(next));
    } catch {
      // Ignore quota / private-mode failures
    }
  }, []);

  return { split, setSplit, commit };
}

/** Drives which single map instance mounts, so we never run two Leaflet maps at once. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return isDesktop;
}

export default function Home() {
  // Pill filters (age / weeks / zip) — applied client-side so results narrow live.
  const { state: pill, setState: setPill, hydrated } = usePillState();

  // Modal filters — interests / session type / price, on the shared v1 Filters
  // model and applied server-side. Age, weeks, and zip live in the pill, so the
  // ages/weeks/zip fields here stay empty and their panel sections are hidden.
  // Persisted to localStorage (like the pill) so they survive navigation, e.g.
  // a tag-pill tap on the camp detail page.
  const { state: filters, setState: setFilters, hydrated: filtersHydrated } = useFilterState();
  const patchFilters = useCallback(
    (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch })),
    [setFilters],
  );

  // Tag-pill hand-off: the camp detail page deep-links here with `?interest=`
  // to replace the interest filter while leaving everything else — which lives
  // in localStorage — untouched. Applied once localStorage has hydrated (so it
  // wins over, rather than races, the stored value), then stripped from the
  // URL so a later refresh or "Clear all" doesn't resurrect it.
  useEffect(() => {
    if (!filtersHydrated) return;
    const params = new URLSearchParams(window.location.search);
    const interest = params.get('interest');
    if (!interest) return;

    setFilters((prev) => ({ ...prev, interests: [interest] }));

    params.delete('interest');
    const query = params.toString();
    window.history.replaceState(null, '', query ? `/?${query}` : '/');
  }, [filtersHydrated, setFilters]);

  const [camps, setCamps] = useState<Camp[]>([]);
  /** Camps with no sessions at all, returned separately by the API. */
  const [undated, setUndated] = useState<Camp[]>([]);
  const [allCamps, setAllCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableInterests, setAvailableInterests] = useState<string[]>([]);

  /** Free-text search over name, place and description. Client-side: 108 camps. */
  const [query, setQuery] = useState('');
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  // null = follow the default (distance once a zip is set, A–Z otherwise).
  const [sortOverride, setSortOverride] = useState<SortMode | null>(null);
  const sortZipRef = useRef<HTMLInputElement>(null);
  const [hoveredCampId, setHoveredCampId] = useState<string | null>(null);
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);

  const { split, setSplit, commit: commitSplit } = useSplit();
  const [dragging, setDragging] = useState(false);
  const splitRowRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const cardColumns = useCardColumns(listRef);
  const cardGridStyle = { gridTemplateColumns: `repeat(${cardColumns}, minmax(0, 1fr))` };

  const splitFromClientX = useCallback((clientX: number) => {
    const rect = splitRowRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return ((clientX - rect.left) / rect.width) * 100;
  }, []);

  const isDesktop = useIsDesktop();

  /**
   * The full-screen mobile map hangs below the header. It used to hardcode 64px, which
   * held only while the header was the topmost thing on screen — the beta banner now sits
   * above it, so at scroll-top the header is pushed down and a 64px offset would cover its
   * bottom half. Measure instead. Body scroll is locked while the map is open, so the
   * header can't move underneath us and one reading at open time stays correct.
   */
  const headerRef = useRef<HTMLElement>(null);
  const [mapTop, setMapTop] = useState(64);

  useEffect(() => {
    if (!mobileMapOpen) return;
    const bottom = headerRef.current?.getBoundingClientRect().bottom;
    if (bottom != null) setMapTop(Math.max(0, bottom));
  }, [mobileMapOpen]);

  useEffect(() => {
    const fetchInterests = async () => {
      try {
        const response = await fetch('/api/interests');
        if (!response.ok) return;

        const data = await response.json();
        if (data.error || !Array.isArray(data.interests)) return;

        setAvailableInterests(data.interests);
      } catch (err) {
        console.error('Error fetching interests:', err);
      }
    };

    fetchInterests();
  }, []);

  // Unfiltered baseline. The week picker is built from this so weeks never vanish
  // from the picker as the user narrows results.
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const response = await fetch('/api/camps');
        if (!response.ok) return;

        const data = await response.json();
        if (Array.isArray(data.camps)) setAllCamps(data.camps);
      } catch (err) {
        console.error('Error fetching camp baseline:', err);
      }
    };

    fetchAll();
  }, []);

  const fetchCamps = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Only interests / session type / price go to the server; age, weeks, and
      // zip are held in the pill and narrowed client-side below, so they stay
      // empty in `filters` and are omitted from the query.
      const params = filtersToSearchParams(filters);

      const response = await fetch(`/api/camps?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Unable to load camps. Please try again later.');
        setCamps([]);
        setUndated([]);
        return;
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setCamps([]);
        setUndated([]);
      } else {
        setCamps(Array.isArray(data.camps) ? data.camps : []);
        setUndated(Array.isArray(data.undated) ? data.undated : []);
      }
    } catch (err) {
      console.error('Error fetching camps from Supabase:', err);
      setError('Unable to connect to the database. Please check your connection and try again.');
      setCamps([]);
      setUndated([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCamps();
  }, [fetchCamps]);

  const zipCenter = useMemo(() => (pill.zip.length === 5 ? lookupZip(pill.zip) : null), [pill.zip]);
  const zipStatus: 'idle' | 'ok' | 'notfound' =
    pill.zip.length < 5 ? 'idle' : zipCenter ? 'ok' : 'notfound';
  const radiusActive = zipCenter !== null;

  const weekOptions = useMemo(() => buildWeekOptions(allCamps), [allCamps]);
  const selectedWeeks = useMemo(
    () => weekOptions.filter((week) => pill.weeks.includes(week.key)),
    [weekOptions, pill.weeks]
  );

  /**
   * Case-insensitive match on the camp's name, address and description, so a
   * parent can type "Art Factory", "Glen Allen" or "robotics". Every word must
   * appear somewhere — "art midlothian" narrows rather than widens.
   */
  const matchesQuery = useCallback(
    (camp: Camp) => {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length === 0) return true;
      const haystack = [camp.name, camp.location, camp.description].filter(Boolean).join(' ').toLowerCase();
      return words.every((word) => haystack.includes(word));
    },
    [query],
  );

  /** Server-filtered camps, narrowed by age + weeks, then decorated with distance. */
  const decorated = useMemo(() => {
    return camps
      .filter(
        (camp) =>
          matchesQuery(camp) &&
          campMatchesAges(camp, pill.ages, pill.matchAllAges) &&
          campMatchesWeeks(camp, selectedWeeks)
      )
      .map((camp) => {
        // Distance is to the nearest site: a parent in Glen Allen cares that
        // the YMCA has a branch near them, not where its first branch is.
        const site = nearestSite(camp, zipCenter);
        return { camp, coords: site.coords, distance: site.distance, site };
      });
  }, [camps, pill.ages, pill.matchAllAges, selectedWeeks, zipCenter, matchesQuery]);

  const sort: SortMode = sortOverride ?? (radiusActive ? 'distance' : 'az');

  const sortCamps = useCallback(
    <T extends { camp: Camp; distance: number | null }>(list: T[]) => {
      const sorted = [...list];

      if (sort === 'distance') {
        sorted.sort((a, b) => {
          if (a.distance === null && b.distance === null) return a.camp.name.localeCompare(b.camp.name);
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
      } else if (sort === 'price') {
        // Camps without a price for the chosen ages and weeks go last, A–Z —
        // most camps haven't posted prices yet, and they shouldn't vanish.
        const price = new Map(
          sorted.map((entry) => [entry.camp.id, cheapestFittingWeeklyPrice(entry.camp, pill.ages, selectedWeeks)]),
        );
        sorted.sort((a, b) => {
          const pa = price.get(a.camp.id) ?? null;
          const pb = price.get(b.camp.id) ?? null;
          if (pa === null && pb === null) return a.camp.name.localeCompare(b.camp.name);
          if (pa === null) return 1;
          if (pb === null) return -1;
          return pa - pb || a.camp.name.localeCompare(b.camp.name);
        });
      } else if (sort === 'updated') {
        // Newest change to the camp or any of its sessions or checks first, so
        // freshly added dates (next summer's, as they come in) surface on top.
        const latest = new Map(
          sorted.map((entry) => {
            const stamps = [
              entry.camp.updated_at,
              entry.camp.last_verified_at,
              ...(entry.camp.camp_sessions ?? []).flatMap((s) => [s.updated_at, s.last_verified_at]),
            ].filter((t): t is string => Boolean(t));
            return [entry.camp.id, stamps.sort().pop() ?? ''];
          }),
        );
        sorted.sort(
          (a, b) =>
            (latest.get(b.camp.id) ?? '').localeCompare(latest.get(a.camp.id) ?? '') ||
            a.camp.name.localeCompare(b.camp.name),
        );
      } else {
        sorted.sort((a, b) => a.camp.name.localeCompare(b.camp.name));
      }

      return sorted;
    },
    [sort, pill.ages, selectedWeeks]
  );

  /**
   * With a zip active: inside the radius is the result set, outside is hidden from the
   * list but kept on the map, and camps we could never place are shown separately rather
   * than silently dropped.
   */
  /**
   * Recommended section gating.
   *
   * Assignment comes only from the PostHog `rec-enabled` flag (50/50, sticky per
   * visitor). There is deliberately no URL-parameter override: this launches into a
   * Facebook group, and a `?variant=` link pasted there would hand everyone who
   * clicked it the same bucket and collapse the split.
   *
   * The age-or-zip condition is what makes recommendations read as contextual rather
   * than random — a parent who has told us nothing gets nothing.
   */
  const recFlagOn = useFeatureFlag(REC_FLAG);
  const hasRecContext = pill.ages.length > 0 || pill.zip.length === 5;
  const showRecommended = recFlagOn && hasRecContext;

  const { listed, unplaceable, outOfRadius } = useMemo(() => {
    if (!radiusActive) {
      return { listed: sortCamps(decorated), unplaceable: [], outOfRadius: [] };
    }

    return {
      listed: sortCamps(decorated.filter((d) => d.distance !== null && d.distance <= pill.radius)),
      unplaceable: decorated.filter((d) => d.coords === null),
      outOfRadius: decorated.filter((d) => d.distance !== null && d.distance > pill.radius),
    };
  }, [decorated, radiusActive, pill.radius, sortCamps]);

  /**
   * Undated camps to surface below the results.
   *
   * Every session-level filter — age, week, session type, price — excludes a
   * camp with no sessions by construction, so the moment a parent touches the
   * pill, 70 of 108 camps vanish with nothing said. We cannot claim these run
   * in the chosen week; we also cannot claim they do not, and dropping them
   * silently makes Richmond look emptier than it is.
   *
   * Shown only when such a filter is active: with none set they are already in
   * the list above, and repeating them would be noise.
   */
  const showUndated =
    pill.ages.length > 0 ||
    selectedWeeks.length > 0 ||
    filters.sessionTypes.length > 0 ||
    filters.priceBrackets.length > 0;

  const undatedListed = useMemo(() => {
    if (!showUndated) return [];
    // The zip radius is applied on the client, so it has to be repeated here;
    // a camp we cannot place is left out rather than guessed at.
    const inRange = radiusActive
      ? undated.filter((camp) =>
          campSites(camp).some((point) => haversineMiles(zipCenter!, point) <= pill.radius),
        )
      : undated;
    return inRange.filter(matchesQuery).sort((a, b) => a.name.localeCompare(b.name));
  }, [undated, showUndated, radiusActive, zipCenter, pill.radius, matchesQuery]);

  /** How many of the shown camps serve every selected age, not just one of them. */
  const fitsAllCount = useMemo(
    () =>
      pill.ages.length > 1
        ? listed.filter(({ camp }) => campMatchesAges(camp, pill.ages, true)).length
        : listed.length,
    [listed, pill.ages]
  );

  /** Distances for the recommended cards, so they read the same as the rest of the list. */
  const distanceById = useMemo(() => {
    const map = new Map<string, number | null>();
    decorated.forEach(({ camp, distance }) => map.set(camp.id, radiusActive ? distance : null));
    return map;
  }, [decorated, radiusActive]);

  const markers: MapMarker[] = useMemo(() => {
    const toMarker = (
      entry: { camp: Camp; coords: { lat: number; lng: number } | null; distance: number | null },
      muted: boolean
    ): MapMarker[] =>
      // A pin per site. They share the camp's id, so hovering the card lights
      // up every branch, and each carries its own key.
      campSites(entry.camp).map((point, index) => ({
        id: entry.camp.id,
        key: `${entry.camp.id}:${index}`,
        name: entry.camp.name,
        location: entry.camp.location,
        lat: point.lat,
        lng: point.lng,
        camp: entry.camp,
        muted,
        distanceMiles: zipCenter ? haversineMiles(zipCenter, point) : entry.distance,
      }));

    return [
      ...listed.flatMap((entry) => toMarker(entry, false)),
      ...outOfRadius.flatMap((entry) => toMarker(entry, true)),
    ];
  }, [listed, outOfRadius, zipCenter]);

  // Ages/weeks/zip stay empty in `filters` (the pill owns them), so this counts
  // only the modal-owned interests / session type / price selections.
  const modalFilterCount = countActiveFilters(filters);

  const hasPillSelections = pill.ages.length > 0 || pill.weeks.length > 0 || pill.zip.length > 0;

  const clearAll = () => {
    capture('filters_cleared', {
      had_ages: pill.ages.length > 0,
      had_weeks: pill.weeks.length > 0,
      had_zip: pill.zip.length > 0,
      had_modal_filters: modalFilterCount > 0,
      had_query: query.trim().length > 0,
    });
    setQuery('');
    setPill(EMPTY_PILL);
    setFilters(emptyFilters());
    setSortOverride(null);
  };

  // The full-screen mobile map owns the viewport; let it, rather than the list, take the scroll.
  useEffect(() => {
    if (!mobileMapOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileMapOpen]);

  useEffect(() => {
    if (isDesktop) setMobileMapOpen(false);
  }, [isDesktop]);

  const mapCaption = radiusActive
    ? `${listed.length} within ${pill.radius} mi`
    : `${markers.length} camp${markers.length === 1 ? '' : 's'} mapped`;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header — fixed 64px (h-16); the sticky map's top offset depends on this. */}
      <header
        ref={headerRef}
        className="sticky top-0 z-30 h-16 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70"
      >
        <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <h1 className="shrink-0 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
              Scouty
            </h1>
            <p className="truncate text-sm leading-tight text-gray-500">
              Richmond summer camp finder
            </p>
          </div>
          <SavedLink />
        </div>
      </header>

      {/* Search, then every filter as its own chip. There is no "More filters"
          modal any more: in the user test parents went looking for price and
          full/half day even while those were behind it. */}
      <div className="border-b border-gray-200 bg-white px-4 pb-4 pt-5 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          {hydrated && filtersHydrated ? (
            <SearchBar
              state={pill}
              onChange={setPill}
              weekOptions={weekOptions}
              zipStatus={zipStatus}
              query={query}
              onQueryChange={setQuery}
              filters={filters}
              onFiltersChange={patchFilters}
              availableInterests={availableInterests}
              onClearAll={clearAll}
            />
          ) : (
            // Same height as the bar, so nothing jumps when saved filters hydrate.
            <div className="h-[100px]" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Two-column shell. The list scrolls with the page; the map column sticks.
          On desktop the columns are separated by a draggable handle. */}
      <div
        ref={splitRowRef}
        className={`grid grid-cols-1 px-4 sm:px-6 lg:px-8 ${dragging ? 'select-none' : ''}`}
        style={
          isDesktop
            ? { gridTemplateColumns: `minmax(0,${split}fr) 20px minmax(0,${100 - split}fr)` }
            : undefined
        }
        onPointerMove={(event) => {
          if (!dragging) return;
          const next = splitFromClientX(event.clientX);
          if (next !== null) setSplit(clampSplit(next));
        }}
        onPointerUp={() => {
          if (!dragging) return;
          setDragging(false);
          commitSplit(split);
        }}
      >
        <section ref={listRef} className="min-w-0 py-6 pb-24 md:pb-6">
          {loading && (
            <>
              <p className="mb-4 text-gray-600">Loading camps…</p>
              <div className="grid gap-5" style={cardGridStyle}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <CampCardSkeleton key={`skeleton-${idx}`} />
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start">
                <svg
                  className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-red-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-medium text-red-800">Unable to load camps</p>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {showRecommended && <RecommendedSection camps={camps} distances={distanceById} />}

              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <p className="py-1 text-gray-600">
                  {listed.length === 0
                    ? undatedListed.length > 0
                      ? // "Try adjusting your filters" would be a lie sitting directly
                        // above a list of camps: the filters are fine, we simply hold no
                        // dates to match them against.
                        `No camps with dates yet for this search — ${undatedListed.length} below we're still confirming`
                      : 'No camps found. Try adjusting your filters.'
                    : `Found ${listed.length} camp${listed.length === 1 ? '' : 's'}`}
                  {radiusActive && outOfRadius.length > 0 && (
                    <span className="text-gray-500">
                      {' '}
                      · {outOfRadius.length} outside {pill.radius} mi
                    </span>
                  )}

                  {/* With 2+ ages the default is a union, so the count grows as kids are
                      added. Spelling out how many fit everyone keeps that from reading
                      as a bug. */}
                  {pill.ages.length > 1 && !pill.matchAllAges && listed.length > 0 && (
                    <span className="text-gray-500">
                      {' '}
                      · {fitsAllCount} fit all {pill.ages.length} kids
                    </span>
                  )}
                </p>

                {/* Two columns so the zip field lines up under the dropdown. */}
                <div className="grid grid-cols-[auto_auto] items-center gap-x-2 gap-y-2">
                  <label htmlFor="sort" className="text-sm text-gray-600">
                    Sort
                  </label>
                  <select
                    id="sort"
                    value={sort}
                    onChange={(event) => {
                      const next = event.target.value as SortMode;
                      setSortOverride(next);
                      capture('sort_changed', { sort_mode: next, zip_active: radiusActive });
                      // Picking Distance without a zip: put the cursor in the zip field.
                      if (next === 'distance' && !radiusActive) {
                        requestAnimationFrame(() => sortZipRef.current?.focus());
                      }
                    }}
                    // Explicit text-gray-900: without it the select inherits `body`'s
                    // --foreground, which flips to a near-white gray under a dark
                    // color-scheme preference — unreadable against this always-white
                    // control. Options inherit the same color, so neither reads as
                    // disabled/placeholder text.
                    className="select-pill rounded-full border border-gray-300 bg-white py-1.5 pl-4 pr-10 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="distance" className="text-gray-900">Distance</option>
                    <option value="az" className="text-gray-900">A–Z</option>
                    <option value="price" className="text-gray-900">Price: low to high</option>
                    <option value="updated" className="text-gray-900">Recently updated</option>
                  </select>

                  {/* Distance needs a starting point: ask for it right under the
                      dropdown rather than warn. Same zip as the Location chip, so
                      it drives the map, the radius and the chip too. */}
                  {sort === 'distance' && !radiusActive && (
                    <>
                  <label htmlFor="sort-zip" className="sr-only">Distance from zip code</label>
                  <input
                    ref={sortZipRef}
                    id="sort-zip"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="Your zip code"
                    value={pill.zip}
                    onChange={(event) => {
                      const zip = event.target.value.replace(/\D/g, '').slice(0, 5);
                      setPill({ ...pill, zip });
                      if (zip.length === 5) capture('zip_filter_applied', { radius_miles: pill.radius, source: 'sort' });
                    }}
                    aria-invalid={zipStatus === 'notfound'}
                    className="col-start-2 w-full rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  {zipStatus === 'notfound' && (
                    <span role="alert" className="col-start-2 text-xs text-red-600">
                      We couldn&apos;t find that zip code.
                    </span>
                  )}
                    </>
                  )}
                </div>
              </div>

              <p className="mb-4 text-xs text-gray-400">
                Camp details may change — always confirm dates and prices with the camp.
              </p>

              {listed.length === 0 && unplaceable.length === 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                  <p className="text-gray-600">We&apos;re adding more camps every week.</p>
                  <UpdatesSignup source="empty-state" className="mt-4 max-w-md" />
                </div>
              )}

              <div className="grid gap-5" style={cardGridStyle}>
                {listed.map(({ camp, distance, site }) => (
                  <CampCard
                    key={camp.id}
                    camp={camp}
                    distanceMiles={radiusActive ? distance : undefined}
                    sites={site.siteCount > 1 ? { count: site.siteCount, nearest: site.label } : undefined}
                    onHoverChange={(hovered) => setHoveredCampId(hovered ? camp.id : null)}
                  />
                ))}
              </div>

              {unplaceable.length > 0 && (
                <div className="mt-8">
                  <div className="mb-3 border-t border-gray-200 pt-6">
                    <h2 className="text-sm font-semibold text-gray-900">
                      {unplaceable.length} camp{unplaceable.length === 1 ? '' : 's'} without a listed address
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      These camps don&apos;t publish a single street address, so we can&apos;t measure their
                      distance or place them on the map.
                    </p>
                  </div>

                  <div className="grid gap-5" style={cardGridStyle}>
                    {unplaceable.map(({ camp }) => (
                      <CampCard key={camp.id} camp={camp} distanceMiles={null} />
                    ))}
                  </div>
                </div>
              )}

              {undatedListed.length > 0 && (
                <div className="mt-8">
                  <div className="mb-3 border-t border-gray-200 pt-6">
                    <h2 className="text-sm font-semibold text-gray-900">
                      {undatedListed.length} more camp{undatedListed.length === 1 ? '' : 's'} we
                      don&apos;t have dates for yet
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      These may still suit your search — we just can&apos;t say which weeks they run
                      or what ages they take, so they can&apos;t be matched against your filters.
                      We&apos;re confirming their schedules with the camps.
                    </p>
                  </div>

                  <div className="grid gap-5" style={cardGridStyle}>
                    {undatedListed.map((camp) => (
                      <CampCard key={camp.id} camp={camp} distanceMiles={null} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {isDesktop && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize list and map"
            aria-valuenow={Math.round(split)}
            aria-valuemin={SPLIT_MIN}
            aria-valuemax={SPLIT_MAX}
            tabIndex={0}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
            }}
            onDoubleClick={() => commitSplit(SPLIT_DEFAULT)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') commitSplit(split - 2);
              else if (event.key === 'ArrowRight') commitSplit(split + 2);
              else return;
              event.preventDefault();
            }}
            className="group sticky top-16 hidden h-[calc(100vh-4rem)] cursor-col-resize touch-none items-center justify-center self-start focus:outline-none md:flex"
            title="Drag to resize · double-click to reset"
          >
            <span
              className={`h-16 w-1.5 rounded-full transition-colors ${
                dragging ? 'bg-blue-600' : 'bg-gray-300 group-hover:bg-gray-400 group-focus:bg-blue-600'
              }`}
            />
          </div>
        )}

        {isDesktop && (
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] self-start py-6 md:block">
            <div className="h-full">
              <MapPanel
                markers={markers}
                center={zipCenter}
                radiusMiles={pill.radius}
                caption={mapCaption}
                highlightedId={hoveredCampId}
                selectedId={selectedCampId}
                onSelect={setSelectedCampId}
              />
            </div>
          </aside>
        )}
      </div>

      {/* Mobile: list-first, with a floating toggle into a full-screen map. */}
      {!isDesktop && (
        <>
          {mobileMapOpen && (
            <div className="fixed inset-x-0 bottom-0 z-40" style={{ top: mapTop }}>
              <MapPanel
                markers={markers}
                center={zipCenter}
                radiusMiles={pill.radius}
                caption={mapCaption}
                highlightedId={hoveredCampId}
                selectedId={selectedCampId}
                onSelect={setSelectedCampId}
              />
            </div>
          )}

          <button
            onClick={() => {
              const next = !mobileMapOpen;
              setMobileMapOpen(next);
              capture('mobile_map_toggled', { view: next ? 'map' : 'list' });
            }}
            /* Lifts clear of anything else pinned to the bottom edge: the consent
               notice on a first visit (fixed at z-[60]), and the footer once the
               list has been scrolled to its end. Both publish their height as a
               CSS variable, so this is their sum plus the normal 1.5rem inset. */
            style={{
              bottom:
                'calc(1.5rem + var(--consent-height, 0px) + var(--footer-visible, 0px))',
            }}
            className="fixed left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-[bottom] hover:bg-gray-800"
          >
            {mobileMapOpen ? (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                List
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                Map
              </>
            )}
          </button>
        </>
      )}
    </main>
  );
}
