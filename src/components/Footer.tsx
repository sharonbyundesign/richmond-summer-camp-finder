import Link from 'next/link';
import FeedbackLink from '@/components/FeedbackLink';
import FooterLift from '@/components/FooterLift';

/**
 * Quiet, site-wide footer rendered from the root layout. Links to the legal
 * pages and carries the beta note; intentionally low-contrast so it never
 * competes with the finder above it.
 */
export default function Footer() {
  return (
    <footer className="z-20 border-t border-gray-200 bg-white md:sticky md:bottom-0">
      <FooterLift />
      {/* The email signup used to sit here; it now opens from the top banner,
          so the sticky footer is one quiet row of links. */}
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-3 text-sm text-gray-500 sm:flex-row sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {/* Rendered at build time, so it moves on with each deploy rather
              than freezing on the year this was written. */}
          <span className="whitespace-nowrap">&copy; {new Date().getFullYear()} Scouty</span>
          <Link href="/privacy" className="hover:text-gray-700">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-gray-700">
            Terms
          </Link>
          <Link href="/disclaimer" className="hover:text-gray-700">
            Disclaimer
          </Link>
          {/* The one action in this row, so it carries the link color. */}
          <FeedbackLink className="font-medium text-blue-600 hover:text-blue-800" />
        </nav>
      </div>
    </footer>
  );
}
