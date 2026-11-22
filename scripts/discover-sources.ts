/**
 * Find the page on a camp's site that actually holds its schedule.
 *
 * camp_sources was seeded from camps.website_url, which is usually a homepage.
 * The extractor can only read the page it is pointed at, so two of its three
 * biggest misses were "wrong URL" rather than "bad extraction": James River
 * Association's source was thejamesriver.org (no dates anywhere) when the
 * schedule is at /camps/.
 *
 *   npx tsx scripts/discover-sources.ts --scored --limit=12
 *       Dry run over camps whose sessions we already hold, so the result can
 *       be checked against known data.
 *
 *   npx tsx scripts/discover-sources.ts --gaps --limit=20 --write
 *       Add a schedule row for camps with no sessions.
 *
 * With --write it INSERTS a camp_sources row (url_type 'schedule',
 * fetch_priority 1) and leaves the seeded homepage row alone at its lower
 * priority. Nothing is overwritten and nothing touches camps or camp_sessions.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { fetchSource } from '@/lib/extract/fetchSource';
import { heuristicExtractor } from '@/lib/extract/extractSessions';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const flag = (n: string) => process.argv.includes(`--${n}`);

const SCORED = flag('scored');
const GAPS = flag('gaps');
const WRITE = flag('write');
const LIMIT = Number(arg('limit') ?? 10);
const SEASON = Number(arg('season') ?? 2026);
/** Candidate pages fetched per camp. Each costs a polite 1.5s on that host. */
const MAX_CANDIDATES = 4;

/** Link text or href that suggests a schedule rather than a brochure page. */
const PROMISING = /camp|summer|schedule|session|dates|program|register|enroll/i;
/** Pages that look promising but never hold a schedule. */
const UNPROMISING = /login|signin|account|cart|donate|give|employment|job|staff|contact|privacy|policy|blog|news|press/i;

interface CampRow {
  id: string;
  name: string;
  website_url: string | null;
}

function candidateLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const scored = new Map<string, number>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      return;
    }
    if (url.host !== base.host) return; // same site only
    if (!/^https?:$/.test(url.protocol)) return;

    url.hash = '';
    const full = url.toString();
    if (full === baseUrl) return;

    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const haystack = `${text} ${url.pathname}`;
    if (UNPROMISING.test(haystack)) return;
    if (!PROMISING.test(haystack)) return;

    // Weight: both the link text and the path matching beats one of them.
    let score = 0;
    if (PROMISING.test(text)) score += 2;
    if (PROMISING.test(url.pathname)) score += 2;
    if (/schedule|dates|session/i.test(haystack)) score += 3;
    if (/summer/i.test(haystack)) score += 2;
    scored.set(full, Math.max(scored.get(full) ?? 0, score));
  });

  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CANDIDATES)
    .map(([url]) => url);
}

async function rangesOn(url: string): Promise<{ ranges: number; ok: boolean; outcome: string }> {
  const res = await fetchSource(url, null);
  if (res.outcome !== 'ok') return { ranges: 0, ok: false, outcome: res.outcome };
  return { ranges: heuristicExtractor(res.html as string, SEASON).length, ok: true, outcome: 'ok' };
}

async function main() {
  const { data: campsData } = await supabase.from('camps').select('id, name, website_url');
  const { data: sessData } = await supabase.from('camp_sessions').select('camp_id');
  const all = (campsData ?? []) as unknown as CampRow[];
  const withSessions = new Set(
    ((sessData ?? []) as unknown as Array<{ camp_id: string }>).map((s) => s.camp_id),
  );

  const pool = SCORED
    ? all.filter((c) => withSessions.has(c.id) && c.website_url)
    : GAPS
      ? all.filter((c) => !withSessions.has(c.id) && c.website_url)
      : all.filter((c) => c.website_url);

  const camps = pool.slice(0, LIMIT);
  console.log(`${camps.length} camp(s) · ${WRITE ? 'WILL ADD schedule rows' : 'dry run'}\n`);

  let improved = 0;

  for (const camp of camps) {
    const { data: srcData } = await supabase
      .from('camp_sources')
      .select('id, url, url_type')
      .eq('camp_id', camp.id)
      .order('fetch_priority', { ascending: true });
    const sources = (srcData ?? []) as unknown as Array<{ id: string; url: string; url_type: string }>;
    const current = sources[0]?.url ?? (camp.website_url as string);

    if (sources.some((s) => s.url_type === 'schedule')) {
      console.log(`  ${camp.name.slice(0, 40).padEnd(40)} already has a schedule source — skipped`);
      continue;
    }

    const base = await fetchSource(current, null);
    if (base.outcome !== 'ok') {
      console.log(`  ${camp.name.slice(0, 40).padEnd(40)} ${base.outcome} on ${current}`);
      continue;
    }

    const baseRanges = heuristicExtractor(base.html as string, SEASON).length;
    const links = candidateLinks(base.html as string, current);

    let best: { url: string; ranges: number } | null = null;
    const blockedCandidates: string[] = [];
    for (const link of links) {
      const { ranges, ok, outcome } = await rangesOn(link);
      if (!ok) {
        // Worth saying out loud: a promising page that needs a browser is a
        // different problem from one that does not exist, and it is the one a
        // human (or a headless browser) can still rescue.
        blockedCandidates.push(`${outcome}: ${link}`);
        continue;
      }
      if (!best || ranges > best.ranges) best = { url: link, ranges };
    }

    const label = camp.name.slice(0, 40).padEnd(40);
    if (!best || best.ranges <= baseRanges) {
      console.log(`  ${label} current ${String(baseRanges).padStart(2)} ranges · nothing better found`);
      for (const b of blockedCandidates) console.log(`      ${b}`);
      continue;
    }

    improved += 1;
    console.log(`  ${label} current ${String(baseRanges).padStart(2)} → ${String(best.ranges).padStart(2)} ranges`);
    console.log(`      ${best.url}`);

    if (WRITE) {
      const { error } = await supabase.from('camp_sources').insert({
        camp_id: camp.id,
        url: best.url,
        url_type: 'schedule',
        fetch_priority: 1,
        notes: `found by discover-sources: ${best.ranges} date ranges vs ${baseRanges} on ${current}`,
      } as never);
      console.log(error ? `      ! insert failed: ${error.message}` : '      added as a schedule source');
    }
  }

  console.log(`\n${improved} of ${camps.length} camp(s) have a better page available`);
  if (improved && !WRITE) console.log('re-run with --write to add them as schedule sources');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
