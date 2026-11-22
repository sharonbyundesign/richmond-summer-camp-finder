import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { reviewDisabled } from '@/lib/review/guard';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Parent comments waiting on a ruling (local review tool only).
 *
 * The rule, as /terms states it: approve every comment that follows the
 * content rules, positive or negative. Reject one that names a child or a
 * staff member, isn't about the camp, is abusive, or reads as an ad or as
 * written by the camp. Rejecting a comment keeps the parent's answer and tags.
 */
export async function GET() {
  const blocked = reviewDisabled();
  if (blocked) return blocked;
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });

  const { data, error } = await supabase
    .from('camp_checkins' as never)
    .select('id, camp_id, attended_year, would_return, tags, comment, created_at, camps(name)')
    .eq('comment_status', 'pending')
    .not('confirmed_at', 'is', null)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ comments: [], unavailable: true });
  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(request: Request) {
  const blocked = reviewDisabled();
  if (blocked) return blocked;
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const action = body?.action === 'approve' ? 'approved' : body?.action === 'reject' ? 'rejected' : null;
  const reviewedBy = typeof body?.reviewed_by === 'string' ? body.reviewed_by.trim() : '';
  const note = typeof body?.review_note === 'string' ? body.review_note.trim() || null : null;
  if (!id || !action || !reviewedBy) {
    return NextResponse.json({ error: 'id, action and reviewed_by are required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('camp_checkins' as never)
    .update({ comment_status: action, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), review_note: note } as never)
    .eq('id', id)
    .eq('comment_status', 'pending');
  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ outcome: action });
}
