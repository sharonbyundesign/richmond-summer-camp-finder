'use client';

import { googleReviewsUrl } from '@/lib/googleReviews';
import { capture } from '@/lib/analytics';

interface GoogleReviewsLinkProps {
  camp: {
    id: string;
    name: string;
    location?: string | null;
    place_id?: string | null;
  };
  className?: string;
}

export default function GoogleReviewsLink({ camp, className = '' }: GoogleReviewsLinkProps) {
  const { url, hadPlaceId } = googleReviewsUrl(camp);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        // Cards are wrapped in a Link; without this the click navigates to the detail page.
        event.stopPropagation();
        capture('google_reviews_link_clicked', {
          camp_id: camp.id,
          had_place_id: hadPlaceId,
        });
      }}
      className={`inline-flex min-h-[36px] items-center gap-1.5 text-sm font-normal text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline ${className}`}
    >
      <svg className="h-4 w-4 flex-shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.287 3.958c.3.922-.755 1.688-1.539 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.367 2.446c-.783.57-1.838-.196-1.538-1.118l1.286-3.958a1 1 0 00-.364-1.118L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.951-.69l1.285-3.958z" />
      </svg>
      Reviews on Google
    </a>
  );
}
