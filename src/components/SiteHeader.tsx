import Link from 'next/link';

/**
 * The Scouty wordmark bar, for pages that are not the finder itself.
 *
 * The home page keeps its own copy because its header also holds the search
 * pill's measurements; everywhere else shares this so the wordmark cannot
 * drift. The wordmark is a link rather than a heading on these pages: each one
 * has its own h1, which is the thing the page is actually about.
 */
export default function SiteHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-baseline gap-2.5">
          <span className="shrink-0 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
            Scouty
          </span>
          <span className="truncate text-sm leading-tight text-gray-500">
            Richmond summer camp finder
          </span>
        </Link>
        {action ?? (
          <Link href="/" className="shrink-0 text-sm font-medium text-gray-700 hover:text-gray-900">
            Back to Search
          </Link>
        )}
      </div>
    </header>
  );
}
