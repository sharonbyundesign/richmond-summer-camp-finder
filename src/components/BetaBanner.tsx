'use client';

import { useEffect, useRef, useState } from 'react';
import { capture } from '@/lib/analytics';
import { BETA_BANNER_KEY, BETA_BANNER_DISMISSED_CLASS } from '@/lib/betaBanner';
import UpdatesSignup from '@/components/UpdatesSignup';

const SIGNUP_FIELD_ID = 'banner-signup-email';

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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(BETA_BANNER_KEY) === '1') setDismissed(true);
    } catch {
      // Private mode / blocked storage: showing the banner is the safe failure.
    }
  }, []);

  if (dismissed) return null;

  /**
   * Second action: the signup form, in a dialog. It used to live in the footer,
   * where it took a permanent row of a sticky bar; now this banner is the one
   * place to subscribe. Native <dialog>, as in NotifyMeButton: showModal gives
   * focus trapping, Escape to close and an inert page behind it.
   */
  const openSignup = () => {
    capture('beta_signup_clicked');
    dialogRef.current?.showModal();
    document.getElementById(SIGNUP_FIELD_ID)?.focus();
  };
  const closeSignup = () => dialogRef.current?.close();

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
          onClick={openSignup}
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

      <dialog
        ref={dialogRef}
        aria-labelledby="banner-signup-heading"
        // A click whose target is the dialog itself landed on the backdrop.
        onClick={(event) => {
          if (event.target === dialogRef.current) closeSignup();
        }}
        className="w-[92vw] max-w-md rounded-2xl border border-gray-200 bg-white p-0 text-left text-gray-900 shadow-xl backdrop:bg-black/30"
      >
        <div className="relative p-6">
          <button
            type="button"
            onClick={closeSignup}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 id="banner-signup-heading" className="pr-10 text-lg font-semibold">
            Hear about new camps first
          </h2>
          <p className="mt-1 text-sm text-gray-600">We add Richmond camps all the time.</p>
          <UpdatesSignup source="banner" fieldId={SIGNUP_FIELD_ID} className="mt-4" />
        </div>
      </dialog>
    </div>
  );
}
