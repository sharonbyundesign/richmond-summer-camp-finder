/**
 * The site's canonical origin, used for metadataBase, sitemap entries and the
 * Sitemap line in robots.txt.
 *
 * VERCEL_PROJECT_PRODUCTION_URL, not VERCEL_URL. VERCEL_URL is the
 * per-deployment host — it changes on every deploy and redirects — so a
 * sitemap built from it points crawlers at URLs that rotate and 302. The
 * production URL is stable and is the same value even in preview builds, which
 * is what we want: a preview should advertise production's canonical URLs, not
 * its own.
 *
 * Set NEXT_PUBLIC_SITE_URL once the custom domain is connected.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export function siteUrl(): string {
  return SITE_URL;
}
