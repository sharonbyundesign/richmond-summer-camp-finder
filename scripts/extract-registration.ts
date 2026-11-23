/**
 * Registration extractor: when does each camp's registration open?
 *
 *   npx tsx scripts/extract-registration.ts --score
 *       Compare against the camps whose registration we already hold.
 *
 *   npx tsx scripts/extract-registration.ts --camp=<uuid>
 *       One camp: every page read, and what each said.
 *
 *   npx tsx scripts/extract-registration.ts [--limit=N] [--json=out.json]
 *       Dry run over every camp with a website. Writes nothing to the
 *       database; --json saves the findings for review.
 *
 * Reads, per camp: its stored source page, its website, and up to two pages
 * the website links to about summer camp or registration. Same fetcher as the
 * session extractor: robots.txt, an identifying user agent, 1.5 s per host.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { fetchSource } from '@/lib/extract/fetchSource';
import { extractRegistration, hasRegistrationInfo, settleStatus, type RegistrationDraft } from '@/lib/extract/extractRegistration';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const flag = (name: string) => process.argv.includes(`--${name}`);

const SCORE = flag('score');
const ONE = arg('camp');
const LIMIT = Number(arg('limit') ?? 1000);
const SEASON = Number(arg('season') ?? 2027);
const JSON_OUT = arg('json');

interface CampRow {
  id: string;
  name: string;
  website_url: string | null;
}

/** Same-site links that look like they lead to summer camp or registration. */
function campLinks(html: string, base: string): string[] {
  // www.lewisginter.org links to lewisginter.org: the same site.
  const bare = (h: string) => h.replace(/^www\./, '');
  const host = bare(new URL(base).host);
  const out: string[] = [];
  for (const [, href, inner] of Array.from(html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi))) {
    const label = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (bare(url.host) !== host || !/^https?:$/.test(url.protocol)) continue;
    if (/\.(pdf|jpe?g|png|docx?)$/i.test(url.pathname)) continue;
    const text = `${label} ${url.pathname}`.toLowerCase();
    if (!/\bsummer|\bcamps?\b/.test(text)) continue; // not "preschool registration"
    const clean = url.toString().replace(/\/$/, '');
    if (clean !== base.replace(/\/$/, '') && !out.includes(clean)) out.push(clean);
  }
  // Registration pages first, then summer pages.
  return out.sort((a, b) => Number(/regist|enroll/.test(b)) - Number(/regist|enroll/.test(a))).slice(0, 2);
}

/** First non-empty value per field, in page order; evidence from all. */
function merge(drafts: Array<{ url: string; draft: RegistrationDraft }>): RegistrationDraft & { source_url: string | null } {
  const out: RegistrationDraft & { source_url: string | null } = {
    opens_on: null, opens_time: null, priority_opens_on: null, priority_opens_time: null,
    priority_note: null, opens_note: null, status: null, registration_url: null, evidence: [], source_url: null,
  };
  for (const { url, draft } of drafts) {
    if (!hasRegistrationInfo(draft) && !draft.registration_url) continue;
    if (!out.opens_on && draft.opens_on) {
      out.opens_on = draft.opens_on;
      out.opens_time = draft.opens_time;
    }
    if (!out.priority_opens_on && draft.priority_opens_on) {
      out.priority_opens_on = draft.priority_opens_on;
      out.priority_opens_time = draft.priority_opens_time;
      out.priority_note = draft.priority_note;
    }
    if (!out.opens_note && draft.opens_note) out.opens_note = draft.opens_note;
    if (draft.status === 'open' || draft.status === 'waitlist') out.status = out.status === 'open' ? 'open' : draft.status;
    if (!out.registration_url && draft.registration_url) out.registration_url = draft.registration_url;
    if (hasRegistrationInfo(draft)) {
      out.source_url = out.source_url ?? url;
      out.evidence.push(...draft.evidence.map((e) => `${e}  [${url}]`));
    }
  }
  if (out.opens_on) out.opens_note = null;
  out.status = settleStatus(out, new Date().toISOString().slice(0, 10));
  return out;
}

async function readCamp(camp: CampRow) {
  const { data: sourceRows } = await supabase
    .from('camp_sources')
    .select('url')
    .eq('camp_id', camp.id)
    .order('fetch_priority', { ascending: true })
    .limit(1);
  const sourceUrl = ((sourceRows ?? []) as unknown as Array<{ url: string }>)[0]?.url ?? null;

  // Pages we already know hold this camp's schedule or registration: where its
  // sessions and any registration row came from. Summer pages are often two
  // clicks deep from the home page (Lewis Ginter), so these matter.
  const { data: sessionSources } = await supabase
    .from('camp_sessions')
    .select('source_url, start_date')
    .eq('camp_id', camp.id)
    .not('source_url', 'is', null)
    .order('start_date', { ascending: false })
    .limit(20);
  const { data: regSources } = await supabase
    .from('camp_registrations' as never)
    .select('source_url')
    .eq('camp_id', camp.id);
  const known = [
    ...((regSources ?? []) as unknown as Array<{ source_url: string | null }>).map((r) => r.source_url),
    ...((sessionSources ?? []) as unknown as Array<{ source_url: string | null }>).map((r) => r.source_url),
  ];

  const queue = [sourceUrl, ...known, camp.website_url]
    .filter((u): u is string => Boolean(u) && /^https?:\/\//.test(u as string))
    .filter((u, i, a) => a.indexOf(u) === i)
    .slice(0, 3);
  const read: Array<{ url: string; draft: RegistrationDraft }> = [];
  const failures: string[] = [];

  for (let i = 0; i < queue.length && i < 5; i++) {
    const url = queue[i];
    const result = await fetchSource(url, null);
    if (result.outcome !== 'ok' || !result.html) {
      failures.push(`${result.outcome} ${url}`);
      continue;
    }
    read.push({ url, draft: extractRegistration(result.html, SEASON, url) });
    // From the website itself, follow its camp and registration links.
    if (url === camp.website_url) {
      for (const link of campLinks(result.html, url)) if (!queue.includes(link)) queue.push(link);
    }
  }
  return { merged: merge(read), pages: read, failures };
}

async function main() {
  const { data } = await supabase.from('camps').select('id, name, website_url').order('name');
  let camps = ((data ?? []) as unknown as CampRow[]).filter((c) => c.website_url);

  const { data: regData } = await supabase.from('camp_registrations' as never).select('*').eq('season_year', SEASON);
  const known = new Map(((regData ?? []) as unknown as Array<Record<string, unknown>>).map((r) => [r.camp_id as string, r]));

  if (ONE) camps = camps.filter((c) => c.id === ONE);
  else if (SCORE) camps = camps.filter((c) => known.has(c.id));
  camps = camps.slice(0, LIMIT);

  console.log(`${camps.length} camp(s) · season ${SEASON} · ${SCORE ? 'scoring against known rows' : 'dry run, writes nothing'}\n`);

  const findings: Array<Record<string, unknown>> = [];
  let withInfo = 0;
  let fetchFailed = 0;

  for (const camp of camps) {
    const { merged, pages, failures } = await readCamp(camp);
    const found = hasRegistrationInfo(merged);
    if (found) withInfo += 1;
    if (!pages.length) fetchFailed += 1;

    const summary = found
      ? [
          merged.priority_opens_on && `early ${merged.priority_opens_on}${merged.priority_opens_time ? ` ${merged.priority_opens_time}` : ''}`,
          merged.opens_on && `opens ${merged.opens_on}${merged.opens_time ? ` ${merged.opens_time}` : ''}`,
          merged.opens_note && `"${merged.opens_note}"`,
          merged.status,
        ].filter(Boolean).join(' · ')
      : pages.length ? 'nothing found' : `unreadable (${failures[0] ?? 'no pages'})`;
    console.log(`  ${camp.name.slice(0, 46).padEnd(46)} ${summary}`);

    if (SCORE || ONE) {
      const k = known.get(camp.id);
      if (k) {
        console.log(
          `      known: ${[k.priority_opens_on && `early ${k.priority_opens_on}`, k.opens_on && `opens ${k.opens_on}`, k.opens_note && `"${String(k.opens_note).slice(0, 50)}"`, k.status].filter(Boolean).join(' · ')}`,
        );
      }
      for (const e of merged.evidence.slice(0, 4)) console.log(`      ↳ ${e.slice(0, 220)}`);
      if (ONE) for (const p of pages) console.log(`      read ${p.url}`);
    }

    findings.push({ camp_id: camp.id, name: camp.name, found, ...merged, pages: pages.map((p) => p.url), failures });
  }

  console.log(`\n${withInfo} of ${camps.length} camps: registration info found · ${fetchFailed} unreadable`);
  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify(findings, null, 1));
    console.log(`findings → ${JSON_OUT}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
