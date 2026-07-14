import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { weekStartOf, weekLabel } from '@/lib/campFilters';

// Distinct session start-weeks, derived from actual session data (not a
// hardcoded list). Powers the week chips in the filter panel.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error', weeks: [] }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('camp_sessions')
    .select('start_date');

  if (error) {
    console.error('Supabase error (weeks):', error);
    return NextResponse.json({ error: 'Unable to load weeks.', weeks: [] }, { status: 500 });
  }

  const set = new Set<string>();
  for (const row of data || []) {
    const startDate = (row as { start_date?: string | null }).start_date;
    if (startDate) {
      const wk = weekStartOf(startDate);
      if (wk) set.add(wk);
    }
  }

  const weeks = Array.from(set)
    .sort()
    .map((weekStart) => ({ weekStart, label: weekLabel(weekStart) }));

  return NextResponse.json({ weeks });
}
