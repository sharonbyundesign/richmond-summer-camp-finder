'use client';

import { useEffect } from 'react';

/**
 * Published while any part of the footer is on screen, so the mobile Map/List
 * toggle can rest above it instead of landing on the email field and the legal
 * links. Mirrors --consent-height from ConsentBanner; the toggle adds both.
 */
const FOOTER_VISIBLE_VAR = '--footer-visible';

/**
 * Measures how far the footer intrudes into the viewport and writes it to the
 * variable above. Rendered inside <Footer>, which stays a server component.
 *
 * It has to be measured on scroll rather than derived from the footer's height:
 * the footer is only sticky from md up, so on phones it slides into view a few
 * pixels at a time and the toggle should rise with it, not jump.
 */
export default function FooterLift() {
  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer) return;

    const root = document.documentElement;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const { top } = footer.getBoundingClientRect();
      const intrusion = Math.max(0, window.innerHeight - top);
      if (intrusion > 0) {
        root.style.setProperty(FOOTER_VISIBLE_VAR, `${Math.round(intrusion)}px`);
      } else {
        root.style.removeProperty(FOOTER_VISIBLE_VAR);
      }
    };

    // Scroll fires far more often than paint; coalesce to one measure per frame.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(footer);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      root.style.removeProperty(FOOTER_VISIBLE_VAR);
    };
  }, []);

  return null;
}
