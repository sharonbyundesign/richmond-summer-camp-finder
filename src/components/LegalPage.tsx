import Link from 'next/link';

/**
 * Shared shell for the static legal pages (/privacy, /disclaimer). Reuses the
 * site header treatment and a single readable prose column so the pages feel
 * native to the finder rather than bolted on.
 */
export default function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 h-16 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="truncate text-lg font-semibold text-gray-900 hover:text-gray-700 sm:text-xl">
            Richmond Summer Camp Finder
          </Link>
          <Link href="/" className="shrink-0 text-sm font-medium text-gray-700 hover:text-gray-900">
            Back to Search
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{title}</h1>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-gray-700">
          {children}
        </div>
      </div>
    </main>
  );
}

/** Section heading used within legal copy. */
export function LegalHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-4 text-xl font-semibold text-gray-900">{children}</h2>;
}
