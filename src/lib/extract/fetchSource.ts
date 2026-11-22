import { createHash } from 'node:crypto';

/**
 * Identifies the crawler and gives a camp a way to reach us. The launch plan's
 * "scraping ethics" line is this, robotsAllows() and the per-host delay below.
 */
export const USER_AGENT =
  'ScoutyBot/1.0 (+https://scouty-beta.vercel.app; Richmond summer camp listings; scoutyrva@gmail.com)';

/** One request per host at a time, spaced. Camp sites are small and often shared hosting. */
const PER_HOST_DELAY_MS = 1500;
const TIMEOUT_MS = 20_000;

const lastHit = new Map<string, number>();
const robotsCache = new Map<string, string | null>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FetchOutcome =
  | 'ok'
  | 'unchanged'
  | 'not_found'
  | 'blocked'
  | 'needs_js'
  | 'parse_failed'
  | 'error';

export interface FetchResult {
  outcome: FetchOutcome;
  status: number | null;
  html: string | null;
  contentHash: string | null;
  note?: string;
}

async function throttle(host: string) {
  const previous = lastHit.get(host) ?? 0;
  const wait = previous + PER_HOST_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

async function robotsTxt(origin: string): Promise<string | null> {
  if (robotsCache.has(origin)) return robotsCache.get(origin) ?? null;
  let body: string | null = null;
  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    body = response.ok ? await response.text() : null;
  } catch {
    // No robots.txt, or unreachable: treated as "no rules", which is the
    // standard reading. A site that wants us out can say so.
    body = null;
  }
  robotsCache.set(origin, body);
  return body;
}

/**
 * Does robots.txt allow this path? Reads the `*` group and any ScoutyBot group,
 * longest-match wins between Allow and Disallow, which is how the major
 * crawlers resolve it.
 */
export function robotsAllows(robots: string | null, path: string): boolean {
  if (!robots) return true;

  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let current: (typeof groups)[number] | null = null;

  for (const raw of robots.split('\n')) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const [keyRaw, ...rest] = line.split(':');
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && current) {
      current.rules.push({ allow: key === 'allow', path: value });
    }
  }

  const mine = groups.find((g) => g.agents.some((a) => a.includes('scoutybot')));
  const star = groups.find((g) => g.agents.includes('*'));
  const group = mine ?? star;
  if (!group) return true;

  let best: { allow: boolean; length: number } | null = null;
  for (const rule of group.rules) {
    if (rule.path === '') continue; // "Disallow:" with no value means allow all
    if (!path.startsWith(rule.path)) continue;
    if (!best || rule.path.length > best.length) best = { allow: rule.allow, length: rule.path.length };
  }
  return best ? best.allow : true;
}

/** Stable hash of the page's text, so a changed ad or nonce does not look like new data. */
export function hashContent(text: string): string {
  return createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 32);
}

/**
 * Fetch one source page, honouring robots.txt and a per-host delay.
 *
 * `knownHash` short-circuits to `unchanged` so an unchanged page costs nothing
 * downstream — the launch plan's change detection, and what keeps an LLM step
 * affordable when one is wired in.
 */
export async function fetchSource(url: string, knownHash?: string | null): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { outcome: 'error', status: null, html: null, contentHash: null, note: 'bad url' };
  }

  const robots = await robotsTxt(parsed.origin);
  if (!robotsAllows(robots, parsed.pathname)) {
    return { outcome: 'blocked', status: null, html: null, contentHash: null, note: 'robots.txt' };
  }

  await throttle(parsed.host);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 404 || response.status === 410) {
      return { outcome: 'not_found', status: response.status, html: null, contentHash: null };
    }
    if (response.status === 403 || response.status === 429) {
      return { outcome: 'blocked', status: response.status, html: null, contentHash: null };
    }
    if (!response.ok) {
      return { outcome: 'error', status: response.status, html: null, contentHash: null };
    }

    const html = await response.text();
    const hash = hashContent(html.replace(/<script[\s\S]*?<\/script>/gi, ''));

    if (knownHash && knownHash === hash) {
      return { outcome: 'unchanged', status: response.status, html, contentHash: hash };
    }
    return { outcome: 'ok', status: response.status, html, contentHash: hash };
  } catch (err) {
    const note = err instanceof Error ? err.name : 'unknown';
    return { outcome: 'error', status: null, html: null, contentHash: null, note };
  }
}
