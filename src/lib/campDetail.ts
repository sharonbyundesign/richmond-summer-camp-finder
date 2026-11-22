import { getSupabaseServerClient } from '@/lib/supabaseServer';
import {
  campDetailSelect,
  isMissingColumnError,
  recordTrustColumnsPresent,
  trustColumnsAssumedPresent,
} from '@/lib/campQuery';

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

  const run = (withTrust: boolean) =>
    (supabase as SupabaseServerClient)
      .from('camps')
      .select(campDetailSelect(withTrust))
      .eq('id', campId)
      .single();

  const wantTrust = trustColumnsAssumedPresent();
  let result = await run(wantTrust);

  if (!result.error) {
    if (wantTrust) recordTrustColumnsPresent(true);
  } else if (wantTrust && isMissingColumnError(result.error)) {
    recordTrustColumnsPresent(false);
    result = await run(false);
  }

  if (result.error) {
    // PGRST116 is "no rows" for .single() — the camp simply is not there.
    const missing = result.error.code === 'PGRST116';
    return missing
      ? { ok: false, status: 404, error: 'Camp not found' }
      : { ok: false, status: 500, error: result.error.message };
  }

  return { ok: true, camp: result.data as unknown as Record<string, unknown> };
}
