/**
 * Session extractor — fetch a camp's source page, read candidate sessions from
 * it, validate them, and stage them for review.
 *
 *   npx tsx scripts/extract-sessions.ts --score --limit=20
 *       Measure the extractor against camps whose 2026 sessions we already
 *       hold. Fetches public pages only; writes nothing.
 *
 *   npx tsx scripts/extract-sessions.ts --camp=<uuid>
 *       Dry run for one camp: what it found, and what validation says.
 *
 *   npx tsx scripts/extract-sessions.ts --diagnose --limit=10
 *       For each camp: how many dates are on the page at all, versus how many
 *       the extractor read. A page full of dates and no ranges means the
 *       extractor is weak; a page with no dates means the source URL points
 *       somewhere that never had a schedule on it.
 *
 *   npx tsx scripts/extract-sessions.ts --gaps --limit=10 --write
 *       Stage proposals for camps with no sessions. Rows land in camp_updates
 *       as `pending` or `needs_review` — never `approved` — so nothing reaches
 *       a parent until someone publishes it in the review tool.
 *
 * Nothing here writes to camps or camp_sessions.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { fetchSource } from '@/lib/extract/fetchSource';
import { heuristicExtractor, type SessionDraft } from '@/lib/extract/extractSessions';
import { validateSession, toValidationJson, stagingStatusFor } from '@/lib/validation/campData';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const flag = (name: string) => process.argv.includes(`--${name}`);

const SCORE = flag('score');
const DIAGNOSE = flag('diagnose');
const GAPS = flag('gaps');
const WRITE = flag('write');
const ONE = arg('camp');
const LIMIT = Number(arg('limit') ?? (SCORE ? 15 : 5));
const SEASON = Number(arg('season') ?? (SCORE ? 2026 : 2027));

interface CampRow {
  id: string;
  name: string;
  website_url: string | null;
}

interface SourceRow {
  id: string;
  url: string;
  content_hash: string | null;
}

async function pickCamps(): Promise<CampRow[]> {
  const { data: camps } = await supabase.from('camps').select('id, name, website_url');
  const { data: sessions } = await supabase.from('camp_sessions').select('camp_id');
  const all = (camps ?? []) as unknown as CampRow[];
  const withSessions = new Set(
    ((sessions ?? []) as unknown as Array<{ camp_id: string }>).map((s) => s.camp_id),
  );

  if (ONE) return all.filter((c) => c.id === ONE);

  const pool = SCORE || DIAGNOSE
    ? all.filter((c) => withSessions.has(c.id) && c.website_url)
    : GAPS
      ? all.filter((c) => !withSessions.has(c.id) && c.website_url)
      : all.filter((c) => c.website_url);

  return pool.slice(0, LIMIT);
}

async function knownSessionKeys(campId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('camp_sessions')
    .select('start_date, end_date')
    .eq('camp_id', campId);
  const rows = (data ?? []) as unknown as Array<{ start_date: string | null; end_date: string | null }>;
  return new Set(rows.map((s) => `${s.start_date}|${s.end_date}`));
}

async function stage(camp: CampRow, drafts: SessionDraft[], sourceId: string | null): Promise<number> {
  let staged = 0;

  for (const draft of drafts) {
    const result = validateSession(draft, SEASON);
    const proposed: Record<string, unknown> = { ...draft };
    delete proposed.evidence;

    const { error } = await supabase.from('camp_updates').insert({
      camp_id: camp.id,
      source_id: sourceId,
      target_table: 'camp_sessions',
      change_type: 'insert',
      season_year: SEASON,
      proposed,
      validation: toValidationJson(result),
      // pending / needs_review, never approved. A human publishes it, and that
      // is what decides human_checked vs auto on the row that reaches parents.
      status: stagingStatusFor(result),
      confidence: draft.confidence_dates ?? null,
      extractor: 'heuristic-v1',
      review_note: `extracted from: ${draft.evidence.slice(0, 160)}`,
    } as never);

    if (error) console.error(`      ! insert failed: ${error.message}`);
    else staged += 1;
  }

  return staged;
}

async function main() {
  const camps = await pickCamps();
  const mode = SCORE ? 'scoring against known sessions' : WRITE ? 'STAGING to camp_updates' : 'dry run';
  console.log(`${camps.length} camp(s) · season ${SEASON} · ${mode}\n`);

  let totalKnown = 0;
  let totalFound = 0;
  let totalMatched = 0;
  const outcomes: Record<string, number> = {};

  for (const camp of camps) {
    const { data: sourceRows } = await supabase
      .from('camp_sources')
      .select('id, url, content_hash')
      .eq('camp_id', camp.id)
      .order('fetch_priority', { ascending: true })
      .limit(1);

    const source = ((sourceRows ?? []) as unknown as SourceRow[])[0];
    const url = source?.url ?? (camp.website_url as string);

    // Scoring ignores the stored hash: we want the page every time.
    const result = await fetchSource(url, SCORE ? null : source?.content_hash);
    outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;

    const label = camp.name.slice(0, 44).padEnd(44);

    if (result.outcome !== 'ok') {
      console.log(`  ${label} ${result.outcome}${result.note ? ` (${result.note})` : ''}`);
      if (WRITE && source) {
        await supabase
          .from('camp_sources')
          .update({
            last_fetched_at: new Date().toISOString(),
            last_status: result.status,
            last_outcome: result.outcome,
          } as never)
          .eq('id', source.id);
      }
      continue;
    }

    const drafts = heuristicExtractor(result.html as string, SEASON);
    const inSeason = drafts.filter((d) => d.start_date?.startsWith(String(SEASON)));

    if (DIAGNOSE) {
      // Count bare "Month D" mentions in the visible text. If a page is full of
      // them and the extractor read none, the extractor is the problem; if the
      // page has none, we are pointed at a page that never held a schedule.
      const text = (result.html as string)
        .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');
      const hits = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep)[a-z]*\.?\s+\d{1,2}/gi) ?? [];
      const known = await knownSessionKeys(camp.id);
      console.log(
        `  ${label} known ${String(known.size).padStart(3)}` +
          `  dates-on-page ${String(hits.length).padStart(3)}` +
          `  ranges-read ${String(drafts.length).padStart(3)}`,
      );
      console.log(`      ${url}`);
      if (hits.length) console.log(`      e.g. ${hits.slice(0, 5).join(' | ')}`);
      continue;
    }

    if (SCORE) {
      const known = await knownSessionKeys(camp.id);
      const found = new Set(inSeason.map((d) => `${d.start_date}|${d.end_date}`));
      const matched = Array.from(found).filter((k) => known.has(k)).length;

      totalKnown += known.size;
      totalFound += found.size;
      totalMatched += matched;

      console.log(
        `  ${label} known ${String(known.size).padStart(3)}` +
          `  found ${String(found.size).padStart(3)}` +
          `  matched ${String(matched).padStart(3)}`,
      );
      continue;
    }

    console.log(`  ${label} ${inSeason.length} candidate session(s)`);
    for (const d of inSeason.slice(0, 6)) {
      const issues = validateSession(d, SEASON).issues;
      console.log(
        `      ${d.start_date} → ${d.end_date}` +
          `${d.price != null ? `  $${d.price}` : ''}` +
          `${d.min_age != null ? `  ages ${d.min_age}-${d.max_age}` : ''}` +
          `${issues.length ? `  [${issues.map((i) => i.rule).join(', ')}]` : ''}`,
      );
    }

    if (WRITE) {
      const staged = await stage(camp, inSeason, source?.id ?? null);
      console.log(`      staged ${staged} proposal(s) for review`);
      if (source) {
        await supabase
          .from('camp_sources')
          .update({
            last_fetched_at: new Date().toISOString(),
            last_status: result.status,
            last_outcome: 'ok',
            content_hash: result.contentHash,
          } as never)
          .eq('id', source.id);
      }
    }
  }

  const summary = Object.entries(outcomes)
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');
  console.log(`\nfetch outcomes: ${summary}`);

  if (SCORE) {
    const recall = totalKnown ? (100 * totalMatched) / totalKnown : 0;
    const precision = totalFound ? (100 * totalMatched) / totalFound : 0;
    console.log(
      `\nagainst ${totalKnown} known ${SEASON} sessions:\n` +
        `  found     ${totalFound}\n` +
        `  matched   ${totalMatched}\n` +
        `  recall    ${recall.toFixed(0)}%  (of real sessions, how many it found)\n` +
        `  precision ${precision.toFixed(0)}%  (of what it found, how much was real)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
