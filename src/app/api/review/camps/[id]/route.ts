import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { reviewDisabled, REVIEW_SEASON_YEAR } from '@/lib/review/guard';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PROPOSAL_COLUMNS =
  'id, proposed, validation, confidence, extractor, review_note, extracted_at, status, source_id';

/**
 * Everything staged for this camp and not yet ruled on — the extractor's and
 * the camp's own (migration 008), with who sent the latter. Before 008 the
 * submission columns do not exist, so the plain query is the fallback.
 */
async function loadProposals(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  campId: string,
) {
  const query = (columns: string) =>
    supabase
      .from('camp_updates')
      .select(columns)
      .eq('camp_id', campId)
      .eq('target_table', 'camp_sessions')
      .in('status', ['pending', 'needs_review'])
      .order('extracted_at', { ascending: true });

  // Newest schema first: the sender with any registration date they gave
  // (010), then the sender alone (008), then the plain proposal.
  const sender = 'contact_name, contact_email, contact_role, message, created_at';
  const withRegistration = await query(
    `${PROPOSAL_COLUMNS}, submission_id,
     submission:camp_submissions(${sender}, registration_opens_on, registration_opens_time, registration_note, registration_url)`,
  );
  if (!withRegistration.error) return withRegistration;
  const withSender = await query(`${PROPOSAL_COLUMNS}, submission_id, submission:camp_submissions(${sender})`);
  return withSender.error ? query(PROPOSAL_COLUMNS) : withSender;
}

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

  const [campResult, sourcesResult, proposalsResult, registrationResult] = await Promise.all([
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
    // Everything the extractor staged and nobody has ruled on yet. These are
    // what a reviewer should be reading — typing a session by hand is the
    // fallback, not the main path.
    loadProposals(supabase, params.id),
    // This season's registration window (010); absent before that migration.
    supabase
      .from('camp_registrations' as never)
      .select('opens_on, opens_time, priority_opens_on, priority_opens_time, priority_note, opens_note, registration_url, status, fills_fast, source_url, verification_status, last_verified_at')
      .eq('camp_id', params.id)
      .eq('season_year', REVIEW_SEASON_YEAR)
      .maybeSingle(),
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
    registration: registrationResult.error ? null : registrationResult.data,
    registration_available: !registrationResult.error,
    proposals: proposalsResult.data ?? [],
  });
}
