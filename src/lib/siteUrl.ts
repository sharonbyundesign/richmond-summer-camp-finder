/**
 * Absolute origin for canonical URLs, sitemap entries and robots.
 *
 * NEXT_PUBLIC_SITE_URL is the one to set once the custom domain is connected;
 * until then Vercel's own VERCEL_URL covers preview and production builds, and
 * the beta host is the last resort so a local build still produces sane
 * absolute links.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://scouty-beta.vercel.app';
}
