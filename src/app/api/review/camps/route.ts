import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { reviewDisabled, REVIEW_SEASON_YEAR } from '@/lib/review/guard';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type Row = {
  id: string;
  name: string;
  location: string | null;
  website_url: string | null;
  source_url: string | null;
  season_year: number | null;
  camp_sessions: Array<{ season_year: number | null }>;
};

/**
 * The review queue. Camps with nothing at all come first — a parent landing on
 * one of those sees a page with no dates on it — then camps carrying only last
 * season's data, then the ones already done.
 */
export async function GET() {
  const blocked = reviewDisabled();
  if (blocked) return blocked;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('camps')
    .select('id, name, location, website_url, source_url, season_year, camp_sessions(season_year)')
    .order('name', { ascending: true });

  if (error) {
    console.error('[review] camp list failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const camps = ((data as unknown as Row[]) ?? []).map((c) => {
    const sessions = c.camp_sessions ?? [];
    const inSeason = sessions.filter((s) => s.season_year === REVIEW_SEASON_YEAR).length;
    const stale = sessions.length - inSeason;
    return {
      id: c.id,
      name: c.name,
      location: c.location,
      website_url: c.website_url,
      source_url: c.source_url,
      sessions_in_season: inSeason,
      sessions_stale: stale,
      state: inSeason > 0 ? 'done' : stale > 0 ? 'stale' : 'empty',
    };
  });

  const rank = { empty: 0, stale: 1, done: 2 } as const;
  camps.sort(
    (a, b) =>
      rank[a.state as keyof typeof rank] - rank[b.state as keyof typeof rank] ||
      a.name.localeCompare(b.name),
  );

  return NextResponse.json({
    season: REVIEW_SEASON_YEAR,
    counts: {
      empty: camps.filter((c) => c.state === 'empty').length,
      stale: camps.filter((c) => c.state === 'stale').length,
      done: camps.filter((c) => c.state === 'done').length,
    },
    camps,
  });
}
