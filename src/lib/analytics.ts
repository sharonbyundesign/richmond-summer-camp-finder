'use client';

import posthog from 'posthog-js';

/**
 * Two names are in play: this branch provisioned NEXT_PUBLIC_POSTHOG_KEY on Vercel, while
 * the beta was configured with NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN. Accept either, or the
 * deployment whose env uses the other name initialises PostHog with `undefined` and
 * silently captures nothing — a failure with no error and no console output.
 */
const KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

/** The 50/50 flag gating the Recommended-for-you section. */
export const REC_FLAG = 'rec-enabled';

let started = false;
const readyListeners = new Set<() => void>();

/**
 * No key means no PostHog: every capture below becomes a no-op and feature flags
 * resolve to false. Real parents are using this, so an unconfigured analytics stack
 * must degrade to "nothing renders, nothing breaks" rather than throw.
 */
export function initAnalytics() {
  if (started || typeof window === 'undefined' || !KEY) return;

  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: 'always',
    capture_pageview: true,
    capture_pageleave: true,
    // Session recording (Task 3). Also honoured by the project-level toggle in PostHog.
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: false,
      // The zip box is the only free-text field; nothing here is sensitive, but keep
      // password-ish inputs masked by default.
      maskInputOptions: { password: true },
    },
  });

  started = true;
  readyListeners.forEach((listener) => listener());
  readyListeners.clear();
}

export function isAnalyticsReady() {
  return started;
}

/**
 * Notifies once `initAnalytics` has run. `Providers` calls `initAnalytics` from its own
 * effect, which — because React fires child effects before parent effects — can run
 * *after* a descendant's mount-time effect already checked `isAnalyticsReady()` and found
 * it false. Without this, that descendant has no way to learn analytics became ready
 * later and gets stuck treating it as never-ready (see useFeatureFlag).
 */
export function onAnalyticsReady(callback: () => void): () => void {
  if (started) {
    callback();
    return () => {};
  }
  readyListeners.add(callback);
  return () => readyListeners.delete(callback);
}

/**
 * Canonical taxonomy. These are the names already flowing into PostHog from the live
 * beta, so they stay as-is — renaming them would split every funnel into a
 * before/after series and make the rec comparison unreadable.
 */
export type EventName =
  // New in v2.1 — the recommendation fake door and the Google reviews link-out.
  | 'rec_section_viewed'
  | 'rec_card_clicked'
  | 'google_reviews_link_clicked'
  // Data-quality feedback from the camp detail page footnote.
  | 'report_incorrect_info_clicked'
  // Beta banner: engage vs. close.
  | 'beta_feedback_clicked'
  | 'beta_banner_dismissed'
  // Existing funnel.
  | 'camp_saved'
  | 'camp_unsaved'
  | 'camp_website_visited'
  | 'session_saved'
  | 'session_unsaved'
  | 'interest_filter_toggled'
  | 'age_filter_changed'
  | 'week_filter_changed'
  | 'zip_filter_applied'
  | 'sort_changed'
  | 'more_filters_opened'
  | 'filters_cleared'
  | 'mobile_map_toggled'
  | 'tag_pill_clicked'
  // Card click-through. Not in the beta taxonomy, but the rec test needs a like-for-like
  // baseline: without it, rec_card_clicked has no ordinary-card counterpart to compare to.
  | 'card_clicked'
  | 'map_pin_clicked';

export function capture(event: EventName, properties?: Record<string, unknown>) {
  if (!started) return;
  posthog.capture(event, properties);
}

/** Flag value, or false when PostHog is unconfigured or still loading. */
export function isFlagEnabled(flag: string): boolean {
  if (!started) return false;
  return posthog.isFeatureEnabled(flag) === true;
}

export function onFlagsLoaded(callback: () => void): () => void {
  if (!started) return () => {};
  return posthog.onFeatureFlags(callback);
}

export { posthog };
