import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/siteUrl';

// Rendered per request rather than baked at build. Static generation freezes
// whatever the origin was at build time, which is how this first shipped
// pointing at localhost in a build where the Vercel env vars were absent.

/**
 * There was no robots.txt at all, so crawlers had no sitemap to follow.
 *
 * /api is disallowed because it serves the same camp data as JSON — indexing it
 * would compete with the pages people should actually land on. /review is the
 * local tool; it 404s in production anyway, and this keeps it out of any
 * crawler's queue.
 */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/review'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
