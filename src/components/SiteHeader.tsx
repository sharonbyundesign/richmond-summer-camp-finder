'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import SavedLink from '@/components/SavedLink';

interface SiteHeaderProps {
  /**
   * Home renders the wordmark as its h1. Elsewhere the page has its own title
   * (a camp's name), so the wordmark is a plain link home.
   */
  logoIsHeading?: boolean;
}

/**
 * The sticky top bar: wordmark on the left, Saved on the right. Fixed at 64px
 * (h-16) — the home page's sticky map offsets itself by this height.
 */
const SiteHeader = forwardRef<HTMLElement, SiteHeaderProps>(function SiteHeader(
  { logoIsHeading = false },
  ref,
) {
  const Wordmark = logoIsHeading ? 'h1' : 'span';

  return (
    <header
      ref={ref}
      className="sticky top-0 z-30 h-16 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70"
    >
      <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-baseline gap-2.5">
          <Wordmark className="shrink-0 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
            Scouty
          </Wordmark>
          <span className="truncate text-sm leading-tight text-gray-500">Richmond summer camp finder</span>
        </Link>
        <SavedLink />
      </div>
    </header>
  );
});

export default SiteHeader;
