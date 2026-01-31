import { NextResponse } from 'next/server';
import { load } from 'cheerio';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const MAX_IMAGES = 8;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server configuration error', details: 'Supabase credentials are not configured.', images: [] },
        { status: 500 }
      );
    }

    const { id: campId } = await params;

    const { data, error } = await supabase
      .from('camps')
      .select('website_url')
      .eq('id', campId)
      .single<{ website_url: string | null }>();

    if (error || !data) {
      return NextResponse.json({ images: [] });
    }

    const websiteUrl = data.website_url;
    if (!websiteUrl) {
      return NextResponse.json({ images: [] });
    }

    const response = await fetch(websiteUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ images: [] });
    }

    const html = await response.text();
    const $ = load(html);

    const imageSet = new Set<string>();
    const candidates: Array<{
      url: string;
      width?: number;
      height?: number;
      alt?: string;
    }> = [];

    const isLikelyLogo = (url: string) => {
      const lower = url.toLowerCase();
      return (
        lower.includes('logo') ||
        lower.includes('/logos') ||
        lower.includes('icon') ||
        lower.includes('favicon') ||
        lower.includes('sprite') ||
        lower.includes('brand')
      );
    };

    const isLikelyTextOverlay = (value?: string | null) => {
      if (!value) return false;
      const lower = value.toLowerCase();
      return (
        lower.includes('banner') ||
        lower.includes('hero') ||
        lower.includes('header') ||
        lower.includes('promo') ||
        lower.includes('flyer') ||
        lower.includes('brochure') ||
        lower.includes('poster') ||
        lower.includes('slide') ||
        lower.includes('ad')
      );
    };

    const isTooSmall = (width?: number, height?: number) => {
      if (!width || !height) return false;
      return width < 300 || height < 200;
    };

    const pushImage = (
      src?: string | null,
      meta?: { width?: number; height?: number; alt?: string }
    ) => {
      if (!src) return;
      try {
        const resolved = new URL(src, websiteUrl).toString();
        if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
          if (!isLikelyLogo(resolved) && !isLikelyTextOverlay(resolved)) {
            candidates.push({
              url: resolved,
              width: meta?.width,
              height: meta?.height,
              alt: meta?.alt,
            });
          }
        }
      } catch {
        // Ignore invalid URLs
      }
    };

    pushImage($('meta[property="og:image"]').attr('content'));
    pushImage($('meta[name="twitter:image"]').attr('content'));

    $('img').each((_, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      const width = parseInt($(img).attr('width') || '', 10);
      const height = parseInt($(img).attr('height') || '', 10);
      const dataWidth = parseInt($(img).attr('data-width') || '', 10);
      const dataHeight = parseInt($(img).attr('data-height') || '', 10);
      const alt = $(img).attr('alt') || undefined;
      pushImage(src, {
        width: Number.isNaN(width) ? dataWidth : width,
        height: Number.isNaN(height) ? dataHeight : height,
        alt,
      });
    });

    for (const candidate of candidates) {
      if (isTooSmall(candidate.width, candidate.height)) continue;
      if (isLikelyTextOverlay(candidate.alt)) continue;
      imageSet.add(candidate.url);
    }

    const images = Array.from(imageSet).slice(0, MAX_IMAGES);
    return NextResponse.json({ images });
  } catch (err) {
    console.error('Unexpected error scraping camp images:', err);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
