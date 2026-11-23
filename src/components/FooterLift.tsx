'use client';

import { useEffect } from 'react';

/**
 * Published while any part of the footer is on screen, so the mobile Map/List
 * toggle can rest above it instead of landing on the legal
 * links. Mirrors --consent-height from ConsentBanner; the toggle adds both.
 */
const FOOTER_VISIBLE_VAR = '--footer-visible';

/**
 * Measures how far the footer intrudes into the viewport and writes it to the
 * variable above. Rendered inside <Footer>, which stays a server component.
 *
 * It has to be measured rather than derived from the footer's height: the
 * footer is only sticky from md up, so on phones it slides into view a few
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

    // Capture phase, not the window's own scroll: below the desktop breakpoint
    // the results list scrolls inside a container, and a scroll event on an
    // element does not bubble — a listener bound to window never hears it.
    // Capturing from window catches scrolls from any scroller on the page.
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);

    // Backstop for movement no scroll reports: the footer reflowing, the list
    // growing as camps load, the consent notice being dismissed.
    const observer = new ResizeObserver(schedule);
    observer.observe(footer);
    observer.observe(document.documentElement);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      root.style.removeProperty(FOOTER_VISIBLE_VAR);
    };
  }, []);

  return null;
}
