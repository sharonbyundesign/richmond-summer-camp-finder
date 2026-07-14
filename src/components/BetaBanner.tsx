'use client';

import { useEffect, useState } from 'react';
import { capture } from '@/lib/analytics';
import { feedbackMailto } from '@/lib/contact';
import { BETA_BANNER_KEY, BETA_BANNER_DISMISSED_CLASS } from '@/lib/betaBanner';

const FEEDBACK_URL = feedbackMailto('Scouty beta feedback');

/**
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
      {/* One line at 375px. The long copy needs ~640px, so the narrow phone gets a
          shortened version rather than a wrap. */}
      <p className="truncate whitespace-nowrap">
        <span className="sm:hidden">In beta — something off? </span>
        <span className="hidden sm:inline">We&apos;re in beta — spot something off or missing? </span>
        <a
          href={FEEDBACK_URL}
          onClick={() => capture('beta_feedback_clicked')}
          className="font-medium underline underline-offset-2 hover:text-blue-700"
        >
          Tell us
        </a>
      </p>

      {/* 44px tap target, absolutely positioned so it doesn't set the bar's height. */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss beta notice"
        className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-blue-900/50 hover:text-blue-900"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
