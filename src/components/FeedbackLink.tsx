'use client';

import { capture } from '@/lib/analytics';
import { feedbackMailto } from '@/lib/contact';

/**
 * Footer feedback link. It read "Send feedback: scoutyrva@gmail.com" for a
 * moment, but the spelled-out address pushed the sticky footer onto two lines
 * between 768px and 900px, so the short label wins. The address is still on
 * /privacy and /disclaimer for anyone without a mail client.
 *
 * Keeps firing `beta_feedback_clicked`: this is the same action the banner used
 * to carry, and renaming it would split the series in two.
 */
export default function FeedbackLink({ className = '' }: { className?: string }) {
  return (
    <a
      href={feedbackMailto('Scouty feedback')}
      onClick={() => capture('beta_feedback_clicked')}
      className={className}
    >
      Contact us
    </a>
  );
}
