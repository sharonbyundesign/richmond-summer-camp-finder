import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { ACTIVE_SEASON_YEAR } from '@/lib/trust';

export const dynamic = 'force-dynamic';

// Same deliberately lenient check as /api/signup: reject obvious typos, not
// judge deliverability.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/notify — "tell me when this camp's dates for the coming season
 * are posted".
 *
 * The season is decided here, not by the caller: a request is always for
 * ACTIVE_SEASON_YEAR, the same constant that makes a camp's card read
 * "2026 dates" in the first place, so the button and the promise it makes
 * cannot disagree.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = (typeof body?.email === 'string' ? body.email : '').trim().toLowerCase();
    const campId = typeof body?.camp_id === 'string' ? body.camp_id : '';

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (!UUID_RE.test(campId)) {
      return NextResponse.json({ error: 'Invalid camp' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { error } = await supabase
      .from('camp_notify_requests')
      .insert({ camp_id: campId, email, season_year: ACTIVE_SEASON_YEAR } as never);

    // 23505: already waiting on this camp for this season — the outcome they
    // wanted, so report success rather than an error.
    if (error && error.code !== '23505') {
      // 23503: the camp id does not exist.
      if (error.code === '23503') {
        return NextResponse.json({ error: 'Invalid camp' }, { status: 400 });
      }
      console.error('[notify] insert failed:', error);
      return NextResponse.json({ error: 'Unable to save your request' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, season: ACTIVE_SEASON_YEAR });
  } catch (err) {
    console.error('[notify] unexpected error:', err);
    return NextResponse.json({ error: 'Unable to save your request' }, { status: 500 });
  }
}
