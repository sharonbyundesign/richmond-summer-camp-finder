import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { reviewDisabled, REVIEW_SEASON_YEAR } from '@/lib/review/guard';
import { validateSession, toValidationJson } from '@/lib/validation/campData';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** Columns a reviewer may change on a staged proposal before approving it. */
const EDITABLE = [
  'name', 'label', 'start_date', 'end_date', 'start_time', 'end_time',
  'days_of_week', 'min_age', 'max_age', 'price', 'capacity',
] as const;

/**
 * Rule on one staged proposal: publish it, or reject it.
 *
 * Approving goes through apply_camp_update() exactly as manual entry does —
 * the function is what stamps verification_status, last_verified_at and
 * source_url, and it reads reviewed_by to decide human_checked over auto. So
 * a session a person approved here is indistinguishable from one they typed,
 * which is the point: the extractor saves typing, it does not lower the bar.
 */
export async function POST(request: Request) {
  const blocked = reviewDisabled();
  if (blocked) return blocked;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const action = body?.action === 'approve' ? 'approve' : body?.action === 'reject' ? 'reject' : null;
  const reviewedBy = typeof body?.reviewed_by === 'string' ? body.reviewed_by.trim() : '';
  const note = typeof body?.review_note === 'string' ? body.review_note.trim() || null : null;
  const edits = (body?.edits ?? null) as Record<string, unknown> | null;
  const acknowledged = body?.acknowledge_warnings === true;

  if (!id || !action) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
  }
  if (!reviewedBy || reviewedBy === 'auto') {
    return NextResponse.json(
      { error: 'reviewed_by is required, and cannot be "auto" — it decides whether this publishes as human_checked' },
      { status: 400 },
    );
  }

  const { data: existing, error: readError } = await supabase
    .from('camp_updates')
    .select('id, proposed, status')
    .eq('id', id)
    .single();

  if (readError || !existing) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const row = existing as unknown as { proposed: Record<string, unknown>; status: string };
  if (!['pending', 'needs_review'].includes(row.status)) {
    return NextResponse.json(
      { error: `Proposal has already been ruled on (${row.status})` },
      { status: 409 },
    );
  }

  if (action === 'reject') {
    const { error } = await supabase
      .from('camp_updates')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        review_note: note,
      } as never)
      .eq('id', id);

    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ outcome: 'rejected' });
  }

  // Approving: fold in any edits, re-validate what will actually be written —
  // never the extractor's original, which the reviewer may have corrected.
  const proposed: Record<string, unknown> = { ...row.proposed };
  if (edits) {
    for (const key of EDITABLE) {
      if (!(key in edits)) continue;
      const value = edits[key];
      proposed[key] = value === '' || value === undefined ? null : value;
    }
  }
  for (const key of Object.keys(proposed)) {
    if (proposed[key] === null || proposed[key] === undefined) delete proposed[key];
  }

  const result = validateSession(
    {
      start_date: proposed.start_date as string | undefined,
      end_date: proposed.end_date as string | undefined,
      price: proposed.price as number | undefined,
      min_age: proposed.min_age as number | undefined,
      max_age: proposed.max_age as number | undefined,
    },
    REVIEW_SEASON_YEAR,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: 'Not published — fix these first',
        issues: result.issues.filter((i) => i.severity === 'error'),
      },
      { status: 400 },
    );
  }

  const warnings = result.issues.filter((i) => i.severity === 'warning');
  if (warnings.length && !acknowledged) {
    return NextResponse.json(
      {
        error: 'Check these, then approve again to confirm',
        needs_acknowledgement: true,
        warnings,
      },
      { status: 409 },
    );
  }

  const { error: updateError } = await supabase
    .from('camp_updates')
    .update({
      proposed,
      validation: toValidationJson(result),
      status: 'approved',
      season_year: REVIEW_SEASON_YEAR,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      review_note: [note, warnings.length ? `warnings acknowledged by ${reviewedBy}` : null]
        .filter(Boolean)
        .join(' | ') || null,
    } as never)
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: applied, error: rpcError } = await supabase.rpc('apply_camp_update' as never, {
    update_id: id,
  } as never);

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json({ outcome: String(applied) });
}
