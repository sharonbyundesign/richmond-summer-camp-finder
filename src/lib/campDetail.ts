import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { campDetailSelect, selectWithFallback } from '@/lib/campQuery';
import { applyServiceArea } from '@/lib/locations';

type SupabaseServerClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

export type CampDetailResult =
  | { ok: true; camp: Record<string, unknown> }
  | { ok: false; status: 404 | 500; error: string };

/**
 * One camp with its sessions, interests and provenance.
 *
 * Shared by the API route and the server-rendered camp page, so the page a
 * crawler reads and the JSON the client reads can never disagree about what a
 * camp is. As elsewhere, a database that has not had migration 001 applied
 * serves the camp without its trust columns instead of failing.
 */
export async function loadCampDetail(campId: string): Promise<CampDetailResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, status: 500, error: 'Supabase credentials are not configured.' };
  }

  const result = await selectWithFallback((features) =>
    (supabase as SupabaseServerClient)
      .from('camps')
      .select(campDetailSelect(features))
      .eq('id', campId)
      .single(),
  );

  if (result.error) {
    // PGRST116 is "no rows" for .single() — the camp simply is not there.
    const missing = result.error.code === 'PGRST116';
    return missing
      ? { ok: false, status: 404, error: 'Camp not found' }
      : { ok: false, status: 500, error: result.error.message };
  }

  // Same rule as the list: out-of-area sites and their sessions never reach the page.
  return { ok: true, camp: applyServiceArea(result.data as unknown as Record<string, unknown>) };
}
