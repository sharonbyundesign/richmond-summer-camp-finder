import Link from 'next/link';

/**
 * Quiet, site-wide footer rendered from the root layout. Links to the legal
 * pages and carries the beta note; intentionally low-contrast so it never
 * competes with the finder above it.
 */
export default function Footer() {
  return (
    <footer className="z-20 border-t border-gray-200 bg-white md:sticky md:bottom-0">
      <div className="flex flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-gray-500 sm:flex-row sm:px-6 lg:px-8">
        <p>Scouty · Beta</p>
        <nav className="flex items-center gap-5">
          <Link href="/privacy" className="hover:text-gray-700">
            Privacy Policy
          </Link>
          <Link href="/disclaimer" className="hover:text-gray-700">
            Disclaimer
          </Link>
          <a href="mailto:scoutyrva@gmail.com" className="hover:text-gray-700">
            Contact Us
          </a>
        </nav>
      </div>
    </footer>
  );
}
