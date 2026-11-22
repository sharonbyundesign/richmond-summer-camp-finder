import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadCampDetail } from '@/lib/campDetail';
import { toCategories } from '@/lib/interest-categories';
import { ageRange, cityFromLocation } from '@/lib/campCardFormat';
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

export default async function CampPage({ params }: Params) {
  const { id } = await params;
  const result = await loadCampDetail(id);

  // A missing camp is a 404, not a page that renders an error — otherwise
  // search engines index a "camp not found" page under the camp's URL.
  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(result.error);
  }

  return <CampDetailClient initialCamp={result.camp as never} />;
}
