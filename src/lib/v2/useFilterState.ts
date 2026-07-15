'use client';

import { useEffect, useState } from 'react';
import {
  emptyFilters,
  SESSION_TYPE_OPTIONS,
  PRICE_BRACKET_OPTIONS,
  type Filters,
  type SessionType,
  type PriceBracket,
} from '@/lib/campFilters';

const STORAGE_KEY = 'scouty:v2:filters';

function sanitize(raw: unknown): Filters {
  const base = emptyFilters();
  if (!raw || typeof raw !== 'object') return base;
  const value = raw as Partial<Filters>;

  return {
    ...base,
    interests: Array.isArray(value.interests)
      ? value.interests.filter((v): v is string => typeof v === 'string')
      : [],
    sessionTypes: Array.isArray(value.sessionTypes)
      ? value.sessionTypes.filter((t): t is SessionType =>
          SESSION_TYPE_OPTIONS.some((o) => o.value === t),
        )
      : [],
    priceBrackets: Array.isArray(value.priceBrackets)
      ? value.priceBrackets.filter((p): p is PriceBracket =>
          PRICE_BRACKET_OPTIONS.some((o) => o.value === p),
        )
      : [],
  };
}

/**
 * Interests / session-type / price selections, persisted to localStorage like
 * the search pill so they survive navigation — e.g. tapping an interest tag on
 * the camp detail page and landing back on the list. Ages/weeks/zip/radius stay
 * empty here; the pill (usePillState) owns those.
 */
export function useFilterState() {
  const [state, setState] = useState<Filters>(emptyFilters);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(sanitize(JSON.parse(raw)));
    } catch {
      // Fall back to empty selections
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota / private-mode failures
    }
  }, [state, hydrated]);

  return { state, setState, hydrated };
}
