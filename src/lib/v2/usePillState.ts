'use client';

import { useEffect, useState } from 'react';

export const RADIUS_OPTIONS = [5, 10, 15, 25, 50] as const;
export const DEFAULT_RADIUS = 10;

const STORAGE_KEY = 'scouty:v2:pill';

export interface PillState {
  ages: number[];
  weeks: string[];
  zip: string;
  radius: number;
}

export const EMPTY_PILL: PillState = {
  ages: [],
  weeks: [],
  zip: '',
  radius: DEFAULT_RADIUS,
};

function sanitize(raw: unknown): PillState {
  if (!raw || typeof raw !== 'object') return EMPTY_PILL;
  const value = raw as Partial<PillState>;

  return {
    ages: Array.isArray(value.ages)
      ? value.ages.filter((age): age is number => typeof age === 'number' && age >= 0 && age <= 18)
      : [],
    weeks: Array.isArray(value.weeks) ? value.weeks.filter((week): week is string => typeof week === 'string') : [],
    zip: typeof value.zip === 'string' ? value.zip.replace(/\D/g, '').slice(0, 5) : '',
    radius:
      typeof value.radius === 'number' && RADIUS_OPTIONS.includes(value.radius as (typeof RADIUS_OPTIONS)[number])
        ? value.radius
        : DEFAULT_RADIUS,
  };
}

/**
 * Pill selections, persisted to localStorage and prefilled on return visits.
 * `hydrated` stays false through the first render so SSR markup matches the client.
 */
export function usePillState() {
  const [state, setState] = useState<PillState>(EMPTY_PILL);
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
