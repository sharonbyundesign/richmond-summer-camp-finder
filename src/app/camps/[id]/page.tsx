import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadCampDetail } from '@/lib/campDetail';
import { toCategories } from '@/lib/interest-categories';
import { ageRange, cityFromLocation } from '@/lib/campCardFormat';
import { loadCheckinSummary } from '@/lib/checkinSummary';
import type { CheckinSummary } from '@/lib/checkins';
import { emailConfigured } from '@/lib/email';
import CampDetailClient from './CampDetailClient';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type Params = { params: Promise<{ id: string }> };

interface CampRow {
  name?: string;
  location?: string | null;
  description?: string | null;
  camp_sessions?: Array<{ min_age?: number | null; max_age?: number | null }>;
  camp_interests?: Array<{ tag?: string; interest_name?: string }>;
}

/**
 * Real per-camp metadata. These pages were previously indistinguishable to a
 * crawler — every one served the site's generic title and no camp content at
 * all — so nothing about any individual camp could be found in search.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const result = await loadCampDetail(id);
  if (!result.ok) return { title: 'Camp not found · Scouty' };

  const camp = result.camp as CampRow;
  const city = cityFromLocation(camp.location);
  const ages = ageRange(camp.camp_sessions as never)?.toLowerCase() ?? null;
  const categories = toCategories((camp.camp_interests ?? []).map((i) => i?.tag || i?.interest_name));

  const title = `${camp.name}${city ? ` · ${city}, VA` : ''} · Summer camp · Scouty`;
  const description =
    camp.description?.trim() ||
    [
      camp.name,
      city ? `in ${city}, Virginia` : 'in the Richmond, Virginia area',
      ages,
      categories.length ? categories.join(', ').toLowerCase() : null,
    ]
      .filter(Boolean)
      .join(' — ');

  return {
    title,
    description,
    alternates: { canonical: `/camps/${id}` },
    openGraph: { title, description, type: 'article' },
  };
}

/**
 * Local preview of the check-in section before email and migration 009 are
 * set up: `?checkins=preview` on a dev server shows the invite and a sample
 * summary, marked as one. Ignored in production.
 */
const PREVIEW_SUMMARY: CheckinSummary = {
  count: 7,
  wouldReturn: 6,
  tags: [
    { id: 'great_counselors', label: 'Great counselors', count: 5 },
    { id: 'made_friends', label: 'Made friends', count: 4 },
    { id: 'pricey', label: 'Pricey for what it was', count: 2 },
  ],
  comments: [
    { text: 'SAMPLE — preview only. Our son came home happy every day and still talks about the river trip.', would_return: true, attended_year: 2026 },
    { text: 'SAMPLE — preview only. Fun week, but pickup was chaotic on the first two days.', would_return: false, attended_year: 2025 },
  ],
};

export default async function CampPage({
  params,
  searchParams,
}: Params & { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const preview =
    process.env.NODE_ENV !== 'production' && (await searchParams)?.checkins === 'preview';
  const result = await loadCampDetail(id);

  // A missing camp is a 404, not a page that renders an error — otherwise
  // search engines index a "camp not found" page under the camp's URL.
  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(result.error);
  }

  // Parents' check-ins: the summary, and whether new ones can be confirmed.
  const checkinSummary = preview ? PREVIEW_SUMMARY : await loadCheckinSummary(id);
  const checkinsEnabled = preview || (emailConfigured() && checkinSummary !== null);

  return (
    <CampDetailClient
      initialCamp={result.camp as never}
      checkinSummary={checkinSummary}
      checkinsEnabled={checkinsEnabled}
    />
  );
}
