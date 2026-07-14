'use client';

import { useEffect, useRef } from 'react';
import CampCard from '@/components/CampCard';
import { capture } from '@/lib/analytics';
import type { Camp } from '@/types/camp';

/**
 * ---------------------------------------------------------------------------
 * FILL IN THE THREE CAMP IDS HERE.
 *
 * Fake door: there is no recommendation algorithm. These three camps are shown
 * to everyone in the flag-on bucket, in this order. Position in the event is the
 * index in this array (1-3), not a ranking.
 * ---------------------------------------------------------------------------
 */
export const RECOMMENDED_CAMP_IDS: string[] = [
  '4321d3bd-2b8d-44bd-8f0b-94d71affca82', // Maymont Summer Discovery Camps
  '8843bb79-b66d-4720-b949-eb1ea2b3aa81', // Richmond SPCA Critter Camp
  'd65f5f76-fcc2-43db-bf8e-1603e57e4040', // Core Kids Academy Summer Camp
];

interface RecommendedSectionProps {
  /** All camps currently loaded; the section picks its three out of this. */
  camps: Camp[];
  /** Distances keyed by camp id, so recommended cards match the rest of the list. */
  distances?: Map<string, number | null>;
}

export default function RecommendedSection({ camps, distances }: RecommendedSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const fired = useRef(false);

  const picks = RECOMMENDED_CAMP_IDS.map((id) => camps.find((camp) => camp.id === id)).filter(
    (camp): camp is Camp => Boolean(camp)
  );

  // rec_section_viewed — once per page, when the section actually enters the viewport.
  useEffect(() => {
    const element = ref.current;
    if (!element || picks.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || fired.current) return;
        fired.current = true;
        capture('rec_section_viewed', { camp_count: picks.length });
        observer.disconnect();
      },
      { threshold: 0.5 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [picks.length]);

  // An empty ID array (or IDs filtered out of the current results) renders nothing —
  // never an empty titled shell.
  if (picks.length === 0) return null;

  return (
    <section ref={ref} className="mb-8">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Recommended for you</h2>
      <p className="mb-4 text-sm text-gray-500">Based on the age and location you entered</p>

      {/* Mobile: horizontal swipe row. Desktop: grid. No hover-dependent behaviour. */}
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3"
        style={{ scrollbarWidth: 'thin' }}
      >
        {picks.map((camp, index) => (
          <div
            key={camp.id}
            className="relative w-[80vw] max-w-[300px] flex-shrink-0 snap-start sm:w-auto sm:max-w-none"
            onClickCapture={() =>
              capture('rec_card_clicked', { camp_id: camp.id, position: index + 1 })
            }
          >
            {/* Deliberately not a heart (that's "saved") and not a star (that's the
                Google reviews link in the footer). A sparkle reads as "we picked this",
                not as a state the parent toggled. */}
            <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white shadow-md ring-1 ring-white/40">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" />
                <path d="M18.5 14l.85 2.5 2.5.85-2.5.85-.85 2.5-.85-2.5-2.5-.85 2.5-.85.85-2.5z" opacity="0.75" />
              </svg>
              Recommended
            </span>

            <CampCard camp={camp} distanceMiles={distances?.get(camp.id) ?? undefined} />
          </div>
        ))}
      </div>

      <hr className="mt-6 border-gray-200" />
    </section>
  );
}
