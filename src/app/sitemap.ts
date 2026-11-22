import type { MetadataRoute } from 'next';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { siteUrl } from '@/lib/siteUrl';

// Rendered per request, not at build. The shared Supabase client sends
// `cache: 'no-store'` so deletions show up immediately, and that makes any
// attempt to prerender this fail — which it did, silently falling back to the
// static pages and shipping a sitemap with no camps in it. One small query.
export const dynamic = 'force-dynamic';

/**
 * Every camp page, so a crawler can find them without guessing UUIDs — there
 * are no links to most camp pages from anywhere a crawler can read, because
 * the list is rendered on the client.
 *
 * `updated_at` becomes lastModified where we have it, which is what tells a
 * crawler to come back after a camp's sessions are re-verified for the season.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/disclaimer`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const supabase = getSupabaseServerClient();
  if (!supabase) return staticPages;

  const { data, error } = await supabase.from('camps').select('id, updated_at');
  const rows = (data as unknown as Array<{ id: string; updated_at?: string | null }> | null) ?? null;
  if (error || !rows) {
    // A sitemap missing its camps is better than a build that fails over it.
    console.error('[sitemap] could not list camps:', error);
    return staticPages;
  }

  const campPages: MetadataRoute.Sitemap = rows.map((camp) => ({
    url: `${base}/camps/${camp.id}`,
    lastModified: camp.updated_at ? new Date(camp.updated_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticPages, ...campPages];
}
