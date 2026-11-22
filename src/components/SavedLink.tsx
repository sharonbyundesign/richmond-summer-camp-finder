'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Header link to the saved list, with a live count.
 *
 * The count starts as null rather than 0 so the server-rendered markup and the
 * first client render agree: localStorage cannot be read until after mount, and
 * guessing 0 would flash a wrong number on anyone who has camps saved.
 *
 * It follows both signals a change can arrive on — `savedCampsUpdated`, which
 * CampCard fires in this tab, and `storage`, which fires when the person saves
 * in another tab.
 */
export default function SavedLink({ className = '' }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    // Camps (saved from cards) plus sessions (saved on a camp's page) — the
    // same two lists the Saved page shows.
    const length = (key: string) => {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(raw) ? raw.length : 0;
    };
    const read = () => {
      try {
        setCount(length('savedCamps') + length('savedSessions'));
      } catch {
        // Private mode or corrupt value: show the link without a count.
        setCount(0);
      }
    };

    read();
    window.addEventListener('savedCampsUpdated', read);
    window.addEventListener('savedSessionsUpdated', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('savedCampsUpdated', read);
      window.removeEventListener('savedSessionsUpdated', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  const saved = count ?? 0;
  const hasSaved = saved > 0;

  return (
    <Link
      href="/saved"
      aria-label={hasSaved ? `Saved, ${saved} items` : 'Saved'}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-900 ${className}`}
    >
      {/* Outlined whether or not anything is saved: the count is what says how
          many, so the heart does not need to shout it too. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className={`h-4 w-4 ${hasSaved ? 'text-red-500' : 'text-gray-400'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
      </svg>
      <span>Saved</span>
      {hasSaved && (
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-semibold leading-none text-gray-700">
          {saved}
        </span>
      )}
    </Link>
  );
}
