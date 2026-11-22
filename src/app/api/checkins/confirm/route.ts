import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/** A confirm link works for a week. */
const LINK_DAYS = 7;

/**
 * GET /api/checkins/confirm?token=… — the link in a parent's confirm email.
 * Marks the check-in confirmed (so it counts), queues its comment for review,
 * and sends the parent back to the camp's page with a thank-you.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const home = (path: string) => NextResponse.redirect(new URL(path, url.origin));
  if (!/^[0-9a-f]{64}$/.test(token)) return home('/?checkin=invalid');

  const supabase = getSupabaseServerClient();
  if (!supabase) return home('/?checkin=invalid');

  const hash = createHash('sha256').update(token).digest('hex');
  const { data } = await supabase
    .from('camp_checkins' as never)
    .select('id, camp_id, comment, created_at')
    .eq('confirm_token_hash', hash)
    .maybeSingle();
  const row = data as { id: string; camp_id: string; comment: string | null; created_at: string } | null;
  if (!row) return home('/?checkin=invalid');
  if (Date.now() - Date.parse(row.created_at) > LINK_DAYS * 86_400_000) {
    return home(`/camps/${row.camp_id}?checkin=expired`);
  }

  const { error } = await supabase
    .from('camp_checkins' as never)
    .update({
      confirmed_at: new Date().toISOString(),
      confirm_token_hash: null,
      comment_status: row.comment ? 'pending' : 'none',
    } as never)
    .eq('id', row.id);
  if (error) {
    console.error('[checkin] confirm failed:', error);
    return home(`/camps/${row.camp_id}?checkin=error`);
  }

  return home(`/camps/${row.camp_id}?checkin=confirmed`);
}
