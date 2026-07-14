'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'scouty:consent-dismissed';

/**
 * Published as a CSS variable while this notice is on screen, so anything else pinned to
 * the bottom of the viewport (the mobile Map/List toggle) can lift clear of it. The card
 * wraps to two rows on narrow phones, so its height is measured rather than assumed.
 */
const CONSENT_HEIGHT_VAR = '--consent-height';

/**
 * First-visit consent notice. Fixed to the bottom of the viewport, dismissed
 * once per browser via localStorage. Kept slim so it stays unobtrusive on
 * mobile and clears the filter modal (which opens near the top of the screen).
 */
export default function ConsentBanner() {
  // Start hidden so the banner never flashes for returning visitors during
  // hydration; we reveal it only after confirming there's no stored dismissal.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {
      // Private mode / storage disabled — show the notice rather than suppress it.
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(CONSENT_KEY, '1');
    } catch {
      // Ignore quota / private-mode failures; worst case it shows again next visit.
    }
  };

  /**
   * Keep the height variable in step with what's actually rendered: it's set while the
   * notice is up, cleared the moment it goes away, and re-measured when the card reflows
   * (rotation, or the copy wrapping to a second row).
   */
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;

    if (!visible || !cardRef.current) {
      root.style.removeProperty(CONSENT_HEIGHT_VAR);
      return;
    }

    const element = cardRef.current;
    const observer = new ResizeObserver(() => {
      root.style.setProperty(CONSENT_HEIGHT_VAR, `${element.offsetHeight}px`);
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(CONSENT_HEIGHT_VAR);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div ref={cardRef} className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          We use cookies and session recordings to improve Scouty during beta. See our{' '}
          <Link href="/privacy" className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 self-end rounded-full bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-800 sm:self-auto"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
