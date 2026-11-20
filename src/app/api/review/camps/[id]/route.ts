import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { reviewDisabled, REVIEW_SEASON_YEAR } from '@/lib/review/guard';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * One camp, with its sessions split by season and the pages we know to read.
 * Last season's sessions come back so they can sit beside the form as
 * reference — they are never used to prefill dates, ages or price.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const blocked = reviewDisabled();
  if (blocked) return blocked;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
  }

  const [campResult, sourcesResult] = await Promise.all([
    supabase
      .from('camps')
      .select(
        `id, name, location, website_url, source_url, season_year, verification_status,
         camp_sessions(id, name, label, start_date, end_date, start_time, end_time,
                       days_of_week, min_age, max_age, price, capacity, season_year,
                       verification_status, last_verified_at)`,
      )
      .eq('id', params.id)
      .single(),
    supabase
      .from('camp_sources')
      .select('id, url, url_type, fetch_priority, notes')
      .eq('camp_id', params.id)
      .order('fetch_priority', { ascending: true }),
  ]);

  if (campResult.error) {
    const missing = campResult.error.code === 'PGRST116';
    return NextResponse.json(
      { error: missing ? 'Camp not found' : campResult.error.message },
      { status: missing ? 404 : 500 },
    );
  }

  const camp = campResult.data as unknown as {
    camp_sessions?: Array<{ season_year: number | null; start_date: string | null }>;
  } & Record<string, unknown>;

  const sessions = (camp.camp_sessions ?? []).slice().sort((a, b) =>
    String(a.start_date ?? '').localeCompare(String(b.start_date ?? '')),
  );

  return NextResponse.json({
    season: REVIEW_SEASON_YEAR,
    camp: { ...camp, camp_sessions: undefined },
    sessions_in_season: sessions.filter((s) => s.season_year === REVIEW_SEASON_YEAR),
    sessions_previous: sessions.filter((s) => s.season_year !== REVIEW_SEASON_YEAR),
    sources: sourcesResult.data ?? [],
  });
}
