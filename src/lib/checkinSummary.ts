import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { CHECKIN_TAGS, SUMMARY_MIN, tagLabel, type CheckinSummary } from '@/lib/checkins';

type Row = {
  would_return: boolean;
  tags: string[] | null;
  comment: string | null;
  comment_status: string;
  attended_year: number;
};

/**
 * One camp's public summary, from confirmed check-ins only. Never returns an
 * email or anything else that identifies a parent. Null when the table is not
 * there yet (migration 009) or the read fails, so the page simply leaves the
 * section out.
 */
export async function loadCheckinSummary(campId: string): Promise<CheckinSummary | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('camp_checkins' as never)
    .select('would_return, tags, comment, comment_status, attended_year')
    .eq('camp_id', campId)
    .not('confirmed_at', 'is', null);
  if (error) return null;

  const rows = (data ?? []) as unknown as Row[];
  const count = rows.length;
  if (count < SUMMARY_MIN) return { count, wouldReturn: null, tags: [], comments: [] };

  const tagCounts = new Map<string, number>();
  for (const row of rows) for (const tag of row.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);

  return {
    count,
    wouldReturn: rows.filter((r) => r.would_return).length,
    tags: CHECKIN_TAGS.filter((t) => tagCounts.has(t.id))
      .map((t) => ({ id: t.id, label: tagLabel(t.id), count: tagCounts.get(t.id)! }))
      .sort((a, b) => b.count - a.count),
    comments: rows
      .filter((r) => r.comment && r.comment_status === 'approved')
      .sort((a, b) => b.attended_year - a.attended_year)
      .map((r) => ({ text: r.comment!, would_return: r.would_return, attended_year: r.attended_year })),
  };
}
