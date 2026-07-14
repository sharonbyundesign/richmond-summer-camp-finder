/**
 * Link-out only. We never fetch, scrape, or store Google review content — we just
 * build a URL and open it in a new tab.
 *
 * The camps table has no place_id column today, so every camp currently takes the
 * search fallback. The place_id branch is live and will start being used the moment
 * the column exists and is populated; nothing else needs to change.
 */

export interface GoogleReviewTarget {
  url: string;
  hadPlaceId: boolean;
}

interface CampLike {
  name: string;
  location?: string | null;
  place_id?: string | null;
}

export function googleReviewsUrl(camp: CampLike): GoogleReviewTarget {
  const placeId = camp.place_id?.trim();

  if (placeId) {
    return {
      url: `https://search.google.com/local/reviews?placeid=${encodeURIComponent(placeId)}`,
      hadPlaceId: true,
    };
  }

  // Name + address gives Maps enough to land on the business. Without the address a
  // generic camp name ("Art Factory Summer Art Camp") can resolve to the wrong city.
  const query = [camp.name, camp.location].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  return {
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    hadPlaceId: false,
  };
}
