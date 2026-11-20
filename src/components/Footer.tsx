import Link from 'next/link';
import UpdatesSignup from '@/components/UpdatesSignup';
import { FOOTER_SIGNUP_FIELD_ID } from '@/lib/signup';
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
      <div className="flex flex-col items-center justify-between gap-3 px-4 py-5 text-sm text-gray-500 sm:flex-row sm:px-6 lg:px-8">
        {/* The Scouty / Beta wordmark used to sit here. Removed: the footer is
            sticky on desktop, so the row has one line of room and the signup
            needs it more than a second logo under the header's. */}
        <UpdatesSignup
          source="footer"
          layout="inline"
          fieldId={FOOTER_SIGNUP_FIELD_ID}
        />
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-gray-700">
            Privacy Policy
          </Link>
          <Link href="/disclaimer" className="hover:text-gray-700">
            Disclaimer
          </Link>
          <FeedbackLink className="hover:text-gray-700" />
        </nav>
      </div>
    </footer>
  );
}
