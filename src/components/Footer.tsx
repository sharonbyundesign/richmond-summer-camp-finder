import Link from 'next/link';
import FooterSignup from '@/components/FooterSignup';

/**
 * Quiet, site-wide footer rendered from the root layout. Links to the legal
 * pages and carries the beta note; intentionally low-contrast so it never
 * competes with the finder above it.
 */
export default function Footer() {
  return (
    <footer className="z-20 border-t border-gray-200 bg-white md:sticky md:bottom-0">
      <div className="flex flex-col items-center justify-between gap-3 px-4 py-5 text-sm text-gray-500 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1.5">
            <span>Scouty</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              Beta
            </span>
          </span>
          <span aria-hidden className="text-gray-300">·</span>
          <FooterSignup />
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
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
