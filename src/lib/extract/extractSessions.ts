import * as cheerio from 'cheerio';

/**
 * A session the extractor believes it found, in the shape camp_updates.proposed
 * takes. Confidence is per field because that is how the trust layer stores it:
 * a camp can have reliable dates and a guessed price.
 */
export interface SessionDraft {
  name?: string | null;
  start_date?: string;
  end_date?: string;
  min_age?: number | null;
  max_age?: number | null;
  price?: number | null;
  confidence_dates?: number | null;
  confidence_price?: number | null;
  confidence_ages?: number | null;
  /** The text this was read from, so a reviewer can check it without the page. */
  evidence: string;
}

/**
 * An extractor turns a page into drafts. The heuristic one below works today;
 * an LLM one (the launch plan's "structured extraction") can be dropped in
 * behind the same signature without the pipeline noticing.
 */
export type Extractor = (html: string, seasonYear: number) => SessionDraft[];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const valid = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

interface Range {
  start: string;
  end: string;
  /** Lower when the year had to be assumed, or the format was ambiguous. */
  confidence: number;
}

/**
 * Date ranges in the shapes camp pages actually use. Ordered most specific
 * first; each match is removed before the next pattern runs so "June 15–19,
 * 2026" is not also read as a bare "June 15".
 */
function findRanges(text: string, seasonYear: number): Range[] {
  const found: Range[] = [];
  let rest = text;

  const consume = (re: RegExp, build: (m: RegExpExecArray) => Range | null) => {
    rest = rest.replace(re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray;
      const range = build(m);
      if (range) found.push(range);
      return ' ';
    });
  };

  // "June 15 – July 2, 2026"  /  "June 15 to July 2"
  consume(
    new RegExp(`${MONTH_RE}\\s+(\\d{1,2})\\s*(?:–|—|-|to|through|thru)\\s*${MONTH_RE}\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?`, 'gi'),
    (m) => {
      const y = m[5] ? Number(m[5]) : seasonYear;
      const m1 = MONTHS[m[1].slice(0, 3).toLowerCase()];
      const m2 = MONTHS[m[3].slice(0, 3).toLowerCase()];
      const d1 = Number(m[2]);
      const d2 = Number(m[4]);
      if (!valid(y, m1, d1) || !valid(y, m2, d2)) return null;
      return { start: iso(y, m1, d1), end: iso(y, m2, d2), confidence: m[5] ? 0.9 : 0.75 };
    },
  );

  // "June 15–19, 2026"  (one month, two days)
  consume(
    new RegExp(`${MONTH_RE}\\s+(\\d{1,2})\\s*(?:–|—|-|to|through|thru)\\s*(\\d{1,2})(?:,?\\s*(\\d{4}))?`, 'gi'),
    (m) => {
      const y = m[4] ? Number(m[4]) : seasonYear;
      const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
      const d1 = Number(m[2]);
      const d2 = Number(m[3]);
      if (d2 < d1 || !valid(y, mo, d1) || !valid(y, mo, d2)) return null;
      return { start: iso(y, mo, d1), end: iso(y, mo, d2), confidence: m[4] ? 0.9 : 0.75 };
    },
  );

  // "6/15 - 6/19" — no month name, so the year is always a guess.
  consume(
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(?:–|—|-|to)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g,
    (m) => {
      const yRaw = m[6] ?? m[3];
      const y = yRaw ? (yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw)) : seasonYear;
      const m1 = Number(m[1]);
      const d1 = Number(m[2]);
      const m2 = Number(m[4]);
      const d2 = Number(m[5]);
      if (!valid(y, m1, d1) || !valid(y, m2, d2)) return null;
      return { start: iso(y, m1, d1), end: iso(y, m2, d2), confidence: yRaw ? 0.6 : 0.45 };
    },
  );

  return found;
}

function findPrice(text: string): { price: number; confidence: number } | null {
  const matches = Array.from(text.matchAll(/\$\s?(\d{2,4}(?:\.\d{2})?)/g), (m) => Number(m[1]));
  const plausible = matches.filter((n) => n >= 25 && n <= 5000);
  if (!plausible.length) return null;
  // One price in the block is a good sign; several means we are guessing which.
  return { price: plausible[0], confidence: plausible.length === 1 ? 0.8 : 0.4 };
}

function findAges(text: string): { min: number; max: number; confidence: number } | null {
  const range = /ages?\s*:?\s*(\d{1,2})\s*(?:–|—|-|to)\s*(\d{1,2})/i.exec(text);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (min <= max && max <= 99) return { min, max, confidence: 0.85 };
  }
  const grades = /grades?\s*:?\s*(\d{1,2})\s*(?:–|—|-|to)\s*(\d{1,2})/i.exec(text);
  if (grades) {
    // Grade N is typically age N+5. Useful, but plainly inferred.
    const min = Number(grades[1]) + 5;
    const max = Number(grades[2]) + 5;
    if (min <= max && max <= 99) return { min, max, confidence: 0.4 };
  }
  return null;
}

/** Readable text blocks: a date and its price usually sit in the same one. */
function blocks(html: string): string[] {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, noscript').remove();

  const out: string[] = [];
  $('li, tr, p, h1, h2, h3, h4, h5, div.card, article, td').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length >= 8 && text.length <= 400) out.push(text);
  });

  // Longest-first de-duplication: a <li> inside a <div> yields both.
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.length - a.length)
    .filter((t) => {
      if (Array.from(seen).some((s) => s.includes(t))) return false;
      seen.add(t);
      return true;
    });
}

/**
 * Heuristic extractor: find a date range in a block of text, then read the
 * price and ages from the same block. Nothing it produces is published — every
 * draft goes to camp_updates for review — so the bias is towards finding
 * candidates a human can confirm or reject quickly.
 */
export const heuristicExtractor: Extractor = (html, seasonYear) => {
  const drafts = new Map<string, SessionDraft>();

  for (const block of blocks(html)) {
    const ranges = findRanges(block, seasonYear);
    if (!ranges.length) continue;

    const price = findPrice(block);
    const ages = findAges(block);
    // A name only if the block is short enough to be a label rather than prose.
    const label = block.length <= 90 ? block.replace(/\s*[-–—:].*$/, '').trim() || null : null;

    for (const range of ranges) {
      const key = `${range.start}|${range.end}`;
      if (drafts.has(key)) continue;
      drafts.set(key, {
        name: label,
        start_date: range.start,
        end_date: range.end,
        min_age: ages?.min ?? null,
        max_age: ages?.max ?? null,
        price: price?.price ?? null,
        confidence_dates: range.confidence,
        confidence_price: price?.confidence ?? null,
        confidence_ages: ages?.confidence ?? null,
        evidence: block.slice(0, 200),
      });
    }
  }

  return Array.from(drafts.values()).sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
};
