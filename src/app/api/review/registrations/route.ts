import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { reviewDisabled, REVIEW_SEASON_YEAR } from '@/lib/review/guard';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const STATUSES = ['unknown', 'upcoming', 'open', 'waitlist', 'full'];

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/**
 * Save a camp's registration window for the review season (local review tool
 * only). One row per camp and summer, so this creates or replaces it.
 */
export async function POST(request: Request) {
  const blocked = reviewDisabled();
  if (blocked) return blocked;
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });

  const body = await request.json().catch(() => null);
  const campId = str(body?.camp_id, 40);
  const reviewedBy = str(body?.reviewed_by, 80);
  if (!campId || !reviewedBy) {
    return NextResponse.json({ error: 'camp_id and reviewed_by are required' }, { status: 400 });
  }

  const issues: string[] = [];
  const date = (key: string) => {
    const v = str(body?.[key], 10);
    if (v && !DATE_RE.test(v)) issues.push(`${key} must be YYYY-MM-DD`);
    return v;
  };
  const time = (key: string) => {
    const v = str(body?.[key], 8);
    if (v && !TIME_RE.test(v)) issues.push(`${key} must be HH:MM`);
    return v;
  };
  const url = str(body?.registration_url, 500);
  if (url && !/^https?:\/\//.test(url)) issues.push('registration_url must start with http');
  const status = STATUSES.includes(body?.status) ? body.status : 'unknown';

  const row = {
    camp_id: campId,
    season_year: REVIEW_SEASON_YEAR,
    opens_on: date('opens_on'),
    opens_time: time('opens_time'),
    priority_opens_on: date('priority_opens_on'),
    priority_opens_time: time('priority_opens_time'),
    priority_note: str(body?.priority_note, 200),
    opens_note: str(body?.opens_note, 200),
    registration_url: url,
    status,
    fills_fast: body?.fills_fast === true,
    source_url: str(body?.source_url, 500),
    verification_status: 'human_checked',
    last_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!row.opens_on && !row.opens_note && !row.priority_opens_on && status === 'unknown') {
    issues.push('Give an opening date, a note, or a status');
  }
  if (issues.length) return NextResponse.json({ error: issues.join('; ') }, { status: 400 });

  const { error } = await supabase
    .from('camp_registrations' as never)
    .upsert(row as never, { onConflict: 'camp_id,season_year' });
  if (error) {
    const missing = error.code === '42P01' || error.code === 'PGRST205';
    return NextResponse.json(
      { error: missing ? 'Run migration 010 first' : error.message },
      { status: missing ? 503 : 500 },
    );
  }
  return NextResponse.json({ outcome: 'saved' });
}
