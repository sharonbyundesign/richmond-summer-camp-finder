'use client';

import { useEffect, useState } from 'react';
import { capture } from '@/lib/analytics';
import { BETA_BANNER_KEY, BETA_BANNER_DISMISSED_CLASS } from '@/lib/betaBanner';
import { FOOTER_SIGNUP_FIELD_ID } from '@/lib/signup';

/**
 * The top bar, now advertising the email list rather than carrying the beta notice.
 * (The honesty it used to do is still on the page: the "Camp details may change"
 * line above the results, the per-camp provenance badges, and the Beta chip in
 * the footer.) The element id, storage key and pre-paint class are unchanged, so
 * anyone who dismissed the old bar stays dismissed.
 *
 * Dismissal has to be known before first paint, or returning visitors get a flash of the
 * banner and the page shifts down under them. React can't do that — localStorage is only
 * readable after hydration — so the blocking script in the root layout stamps a class on
 * <html> and CSS hides this element pre-paint. The `data-beta-banner` hook and the state
 * below are the two halves of that: CSS handles the returning visitor, React handles the
 * click that dismisses it in this session.
 */
export default function BetaBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(BETA_BANNER_KEY) === '1') setDismissed(true);
    } catch {
      // Private mode / blocked storage: showing the banner is the safe failure.
    }
  }, []);

  if (dismissed) return null;

  /**
   * Second action: send people to the one signup form rather than opening a
   * second one. On desktop the footer is sticky, so the field is already on
   * screen and this is really just a focus; on phones it scrolls there.
   */
  const focusSignup = () => {
    capture('beta_signup_clicked');
    const field = document.getElementById(FOOTER_SIGNUP_FIELD_ID);
    if (!field) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    field.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    field.focus({ preventScroll: true });
  };

  const dismiss = () => {
    capture('beta_banner_dismissed');
    setDismissed(true);
    try {
      localStorage.setItem(BETA_BANNER_KEY, '1');
      document.documentElement.classList.add(BETA_BANNER_DISMISSED_CLASS);
    } catch {
      // Dismissal just won't persist to the next visit.
    }
  };

  return (
    <div
      data-beta-banner
      className="relative border-b border-blue-100 bg-blue-50 py-2 pl-4 pr-12 text-center text-xs text-blue-900"
    >
      {/* Short copy on phones, the fuller line from sm up where there's room. */}
      <p className="truncate whitespace-nowrap">
        <span className="sm:hidden">New camps, by email. </span>
        <span className="hidden sm:inline">We add new Richmond camps all the time &mdash; hear about them first &rarr;  </span>
        <button
          type="button"
          onClick={focusSignup}
          className="font-medium underline underline-offset-2 hover:text-blue-700"
        >
          Get updates
        </button>
      </p>

      {/* 44px tap target, absolutely positioned so it doesn't set the bar's height. */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notice"
        className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-blue-900/50 hover:text-blue-900"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
