import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { reviewDisabled, REVIEW_SEASON_YEAR } from '@/lib/review/guard';
import { validateSession, toValidationJson } from '@/lib/validation/campData';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Columns a reviewer may propose. `season_year` is generated from start_date in
 * Postgres and apply_camp_update() rejects generated columns outright, so it
 * must never appear here; `id`, `created_at` and `updated_at` are refused for
 * the same reason.
 */
const WRITABLE = [
  'name', 'label', 'start_date', 'end_date', 'start_time', 'end_time',
  'days_of_week', 'min_age', 'max_age', 'price', 'capacity',
] as const;

type Draft = Partial<Record<(typeof WRITABLE)[number], unknown>>;

/** Drop blanks so an empty form field stays NULL rather than becoming ''. */
function clean(draft: Draft) {
  const out: Record<string, unknown> = {};
  for (const key of WRITABLE) {
    const value = draft[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Publish one camp's sessions for the season.
 *
 * Each row goes in as an `approved` camp_updates proposal and is published by
 * apply_camp_update(), rather than being written to camp_sessions directly.
 * That is not ceremony: the function is what stamps verification_status,
 * last_verified_at and source_url, and it reads `reviewed_by` to decide
 * between 'human_checked' and 'auto'. A direct insert would leave the session
 * looking unverified and leave no record of who entered it.
 */
export async function POST(request: Request) {
  const blocked = reviewDisabled();
  if (blocked) return blocked;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const campId = typeof body?.camp_id === 'string' ? body.camp_id : '';
  const reviewedBy = typeof body?.reviewed_by === 'string' ? body.reviewed_by.trim() : '';
  const sourceId = typeof body?.source_id === 'string' && body.source_id ? body.source_id : null;
  const note = typeof body?.review_note === 'string' ? body.review_note.trim() || null : null;
  const drafts: Draft[] = Array.isArray(body?.sessions) ? body.sessions : [];

  if (!campId) return NextResponse.json({ error: 'camp_id is required' }, { status: 400 });
  if (!drafts.length) return NextResponse.json({ error: 'No sessions supplied' }, { status: 400 });

  // Without a name the published row is labelled 'auto' — machine-entered data.
  // Refusing here is better than silently publishing a human's work as a guess.
  if (!reviewedBy || reviewedBy === 'auto') {
    return NextResponse.json(
      { error: 'reviewed_by is required, and cannot be "auto" — it decides whether this publishes as human_checked' },
      { status: 400 },
    );
  }

  // Validate everything before writing anything, so a bad row five lines down
  // cannot leave half a camp published.
  const prepared = drafts.map((draft, index) => {
    const proposed = clean(draft);
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
    return { index, proposed, result };
  });

  const broken = prepared.filter((p) => !p.result.ok);
  if (broken.length) {
    return NextResponse.json(
      {
        error: 'Nothing was saved — fix these first',
        issues: broken.map((p) => ({
          row: p.index + 1,
          issues: p.result.issues.filter((i) => i.severity === 'error'),
        })),
      },
      { status: 400 },
    );
  }

  const results: Array<{ row: number; outcome: string; update_id?: string; error?: string }> = [];

  for (const { index, proposed, result } of prepared) {
    const { data: created, error: insertError } = await supabase
      .from('camp_updates')
      .insert({
        camp_id: campId,
        source_id: sourceId,
        target_table: 'camp_sessions',
        change_type: 'insert',
        season_year: REVIEW_SEASON_YEAR,
        proposed,
        validation: toValidationJson(result),
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        review_note: note,
        extractor: 'manual-review',
      } as never)
      .select('id')
      .single();

    if (insertError || !created) {
      results.push({ row: index + 1, outcome: 'failed', error: insertError?.message ?? 'insert failed' });
      continue;
    }

    const updateId = (created as { id: string }).id;
    const { data: applied, error: rpcError } = await supabase.rpc('apply_camp_update' as never, {
      update_id: updateId,
    } as never);

    results.push(
      rpcError
        ? { row: index + 1, outcome: 'failed', update_id: updateId, error: rpcError.message }
        : { row: index + 1, outcome: String(applied), update_id: updateId },
    );
  }

  const failed = results.filter((r) => r.outcome !== 'applied');
  return NextResponse.json(
    { applied: results.length - failed.length, total: results.length, results },
    { status: failed.length ? 207 : 200 },
  );
}
