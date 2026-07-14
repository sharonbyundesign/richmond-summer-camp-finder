'use client';

import posthog from 'posthog-js';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

/** The 50/50 flag gating the Recommended-for-you section. */
export const REC_FLAG = 'rec-enabled';

let started = false;

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
}

export function isAnalyticsReady() {
  return started;
}

export type EventName =
  // Recommended section
  | 'rec_section_viewed'
  | 'rec_card_clicked'
  // Google reviews
  | 'google_reviews_link_clicked'
  // Core funnel — these did not exist before; they are created here so both flag
  // states can be compared on the same events.
  | 'card_clicked'
  | 'registration_click'
  | 'camp_saved'
  | 'camp_unsaved'
  | 'zip_entered'
  | 'age_added'
  | 'radius_changed'
  | 'sort_changed'
  | 'search_pill_opened'
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
