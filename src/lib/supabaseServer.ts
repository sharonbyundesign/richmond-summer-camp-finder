import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    global: {
      // Next patches global fetch and caches GETs in its Data Cache. supabase-js goes
      // through that patched fetch, so route handlers can keep serving a snapshot of
      // the database taken at first request — that is what made every camp come back
      // with camp_interests: [] long after the interests were linked.
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
