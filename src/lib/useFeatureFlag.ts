'use client';

import { useEffect, useState } from 'react';
import { isFlagEnabled, onFlagsLoaded, isAnalyticsReady } from '@/lib/analytics';

/**
 * Resolves a PostHog feature flag.
 *
 * Assignment comes only from PostHog — there is deliberately no URL-parameter
 * override. A `?variant=` escape hatch would let a link shared into the Facebook
 * group hand every visitor the same bucket and destroy the 50/50 split.
 *
 * PostHog hashes the distinct_id to pick a bucket, so assignment is sticky per
 * visitor across sessions on the same device.
 *
 * Returns false until flags have loaded, so the gated section never flashes in and
 * then disappears (avoids the layout shift called out in the QA checklist).
 */
export function useFeatureFlag(flag: string): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isAnalyticsReady()) return;

    setEnabled(isFlagEnabled(flag));
    return onFlagsLoaded(() => setEnabled(isFlagEnabled(flag)));
  }, [flag]);

  return enabled;
}
