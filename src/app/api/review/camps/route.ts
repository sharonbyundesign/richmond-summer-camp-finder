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
 * The review queue. Camps with proposals waiting come first (those a camp sent
 * itself at the very top); then camps with nothing at all — a parent landing on
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

  // Proposals nobody has ruled on yet, per camp, and whether any came from the
  // camp itself (migration 008). Without 008 the submission column is absent,
  // so fall back to counting proposals alone.
  const waitingQuery = (withSubmission: boolean) =>
    supabase
      .from('camp_updates')
      .select(withSubmission ? 'camp_id, submission_id' : 'camp_id')
      .eq('target_table', 'camp_sessions')
      .in('status', ['pending', 'needs_review']);
  let waitingResult = await waitingQuery(true);
  if (waitingResult.error) waitingResult = await waitingQuery(false);
  const waiting = new Map<string, { count: number; fromCamp: boolean }>();
  for (const row of (waitingResult.data ?? []) as unknown as Array<{ camp_id: string; submission_id?: string | null }>) {
    const entry = waiting.get(row.camp_id) ?? { count: 0, fromCamp: false };
    entry.count += 1;
    entry.fromCamp ||= Boolean(row.submission_id);
    waiting.set(row.camp_id, entry);
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
      waiting: waiting.get(c.id)?.count ?? 0,
      waiting_from_camp: waiting.get(c.id)?.fromCamp ?? false,
    };
  });

  const rank = { empty: 0, stale: 1, done: 2 } as const;
  // Something a camp sent comes first, then anything else waiting on a ruling:
  // a camp that wrote in should not wait behind the backlog.
  camps.sort(
    (a, b) =>
      Number(b.waiting_from_camp) - Number(a.waiting_from_camp) ||
      Number(b.waiting > 0) - Number(a.waiting > 0) ||
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
