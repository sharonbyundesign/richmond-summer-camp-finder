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
// Whole month words only. "[a-z]*" after the stem read "Junior 10-12" as June
// 10-12 and "Maymont 20" as May 20.
const MONTH_RE =
  '\\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\b\\.?';
/** "15th", "1st": as common on camp pages as bare numbers. */
const ORD = '(?:st|nd|rd|th)?';
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

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

/** Day of week for a date, 0 = Sunday. */
const weekday = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

/** Friday of the week that starts on this date. */
function fridayAfter(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + (5 - dt.getUTCDay()));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Extra evidence for the year, from outside the schedule text. */
export interface YearHints {
  /** When the page was last edited (schema.org dateModified), if it says. */
  modifiedAt?: string | null;
}

/** schema.org dateModified, which WordPress and most CMSs emit. */
export function pageModifiedAt(html: string): string | null {
  return /"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(html)?.[1] ?? null;
}

/**
 * Which year a page means when it prints no year.
 *
 * The same date falls on a different weekday each year, so the weekdays give
 * a lot away: "Jun 14 – Jun 17" is a Sunday in 2026 and a Monday in 2027, and
 * no day camp starts on a Sunday. Without this, a page that has already moved
 * on to next summer is read as this one — which is how James River's 2027
 * Upper James expedition was once staged as a 2026 session.
 *
 * In order of strength:
 *   1. a weekday the page states ("July 13 (Monday)") — it settles the year;
 *   2. weekends — a camp week does not start on one;
 *   3. a year printed on the page ("Summer 2026");
 *   4. when the page was last edited: yearless dates on a page edited after
 *      a summer ended are next summer's (Core Kids' Tue–Thu weeks fit both
 *      years equally; its page was edited in November).
 * With nothing to go on it keeps the season asked for.
 */
export function inferPageYear(text: string, seasonYear: number, hints: YearHints = {}): number {
  // A start date, and the weekday the page says it falls on if it says so
  // ("July 13 - July 17 (Monday - Friday)", "Wednesday, June 3rd").
  const starts = Array.from(
    text.matchAll(
      new RegExp(
        `(?:\\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\\.?,?\\s+)?${MONTH_RE}\\s+(\\d{1,2})${ORD}(?!\\d)(?!,?\\s*\\d{4})` +
          `(?:[^()]{0,24}\\(\\s*(sun|mon|tue|wed|thu|fri|sat))?`,
        'gi',
      ),
    ),
    (m) => {
      const stated = (m[1] ?? m[4])?.toLowerCase();
      return {
        mo: MONTHS[m[2].slice(0, 3).toLowerCase()],
        d: Number(m[3]),
        stated: stated ? DAY_NAMES.indexOf(stated) : -1,
      };
    },
  ).filter(({ mo }) => mo >= 5 && mo <= 8);
  if (starts.length === 0) return seasonYear;

  const candidates = [seasonYear, seasonYear + 1, seasonYear - 1];
  const mentions = (y: number) => (text.match(new RegExp(`\\b${y}\\b`, 'g')) ?? []).length;
  const modified = hints.modifiedAt ?? null;

  const scored = candidates.map((y) => {
    let fit = 0;
    for (const { mo, d, stated } of starts) {
      if (!valid(y, mo, d)) continue;
      const wd = weekday(y, mo, d);
      if (stated >= 0) fit += stated === wd ? 5 : -5;
      else fit += wd === 0 || wd === 6 ? 0 : 1;
    }
    // Tie-breakers, never enough to outweigh a single date's weekday.
    const printed = mentions(y) > 0 ? 0.5 : 0;
    // Edited after summer y-1 ended (Sept 1) and before summer y did: the
    // page was most likely describing summer y when last touched.
    const edited =
      modified && modified >= `${y - 1}-09-01` && modified < `${y}-09-01` ? 0.25 : 0;
    return { y, score: fit + printed + edited };
  });

  // Stable on ties: candidates are listed season-first.
  return scored.reduce((best, c) => (c.score > best.score ? c : best)).y;
}

/**
 * Date ranges in the shapes camp pages actually use. Ordered most specific
 * first; each match is removed before the next pattern runs so "June 15–19,
 * 2026" is not also read as a bare "June 15". `seasonYear` is the year to
 * assume when the text prints none — the page's inferred year, not
 * necessarily the season being extracted.
 */
function findRanges(text: string, seasonYear: number): Range[] {
  const found: Range[] = [];
  let rest = text;

  // `keepOnMiss` leaves text a pattern rejected for the later, looser ones —
  // a list of Mondays is not a run of days, but it is a list of weeks.
  const consume = (re: RegExp, build: (m: RegExpExecArray) => Range | null, keepOnMiss = false) => {
    rest = rest.replace(re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray;
      const range = build(m);
      if (range) found.push(range);
      return range || !keepOnMiss ? ' ' : String(args[0]);
    });
  };

  // "June 15 – July 2, 2026"  /  "June 15 to July 2"
  consume(
    new RegExp(`${MONTH_RE}\\s+(\\d{1,2})${ORD}\\s*(?:–|—|-|to|through|thru)\\s*${MONTH_RE}\\s+(\\d{1,2})${ORD}(?:,?\\s*(\\d{4}))?`, 'gi'),
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
    new RegExp(`${MONTH_RE}\\s+(\\d{1,2})${ORD}\\s*(?:–|—|-|to|through|thru)\\s*(\\d{1,2})${ORD}(?!\\d)(?:,?\\s*(\\d{4}))?`, 'gi'),
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

  // A list of days: "June 15, 16, 17 – Circus Week", "June 29, 30, July 1".
  // The session runs from the first day listed to the last.
  consume(
    new RegExp(`${MONTH_RE}\\s+(\\d{1,2})${ORD}((?:\\s*,\\s*(?:${MONTH_RE}\\s+)?\\d{1,2}${ORD}(?!\\d)){1,6})`, 'gi'),
    (m) => {
      let mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
      const first = Number(m[2]);
      let last = first;
      let lastMonth = mo;
      for (const part of m[3].split(',').map((p) => p.trim()).filter(Boolean)) {
        const named = new RegExp(`^${MONTH_RE}\\s+(\\d{1,2})`, 'i').exec(part);
        if (named) {
          mo = MONTHS[named[1].slice(0, 3).toLowerCase()];
          last = Number(named[2]);
        } else {
          last = Number(part.replace(/\D/g, ''));
        }
        lastMonth = mo;
      }
      const startMonth = MONTHS[m[1].slice(0, 3).toLowerCase()];
      const y = seasonYear;
      if (!valid(y, startMonth, first) || !valid(y, lastMonth, last)) return null;
      const start = iso(y, startMonth, first);
      const end = iso(y, lastMonth, last);
      // Consecutive days, not a list of weeks: "June 1, June 8, June 15" is
      // three sessions (read below), not one from June 1 to 15.
      const span = (Date.parse(end) - Date.parse(start)) / 86_400_000;
      if (span < 0 || span > 6) return null;
      return { start, end, confidence: 0.6 };
    },
    true,
  );

  // A lone summer date standing for a whole week: "Week of June 15", or a
  // list of Mondays ("June 1 · June 8 · June 15"), as Camp Sensory House and
  // Core Kids publish. Read as that Monday to Friday. A bare date is far more
  // often a deadline than a camp week, so without "week of" it must be a
  // Monday and the block must read like a schedule.
  const looksLikeSchedule = /\b(week|session|camp|daily)\b/i.test(text);
  consume(
    new RegExp(`(week\\s+of\\s+)?${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:,?\\s*(\\d{4}))?`, 'gi'),
    (m) => {
      const weekOf = Boolean(m[1]);
      const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
      const d = Number(m[3]);
      const y = m[4] ? Number(m[4]) : seasonYear;
      if (mo < 5 || mo > 8 || !valid(y, mo, d)) return null;
      const wd = weekday(y, mo, d);
      if (!weekOf && !(wd === 1 && looksLikeSchedule)) return null;
      if (wd === 0 || wd === 6) return null;
      return { start: iso(y, mo, d), end: fridayAfter(y, mo, d), confidence: weekOf ? 0.55 : 0.4 };
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

function findAges(text: string, cells?: string[]): { min: number; max: number; confidence: number } | null {
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
  // A table row's bare "6–8" cell: almost always ages in a camp schedule, but
  // with no label saying so.
  for (const cell of cells ?? []) {
    const bare = /^(\d{1,2})\s*(?:–|—|-|to)\s*(\d{1,2})$/.exec(cell);
    if (!bare) continue;
    const min = Number(bare[1]);
    const max = Number(bare[2]);
    if (min >= 3 && min <= max && max <= 19) return { min, max, confidence: 0.6 };
  }
  return null;
}

const DATEISH = new RegExp(`${MONTH_RE}\\s+\\d{1,2}|\\d{1,2}\\/\\d{1,2}`, 'i');

/**
 * A session name, if the block has one. Table rows name the program in its
 * own cell; elsewhere it is the text left once dates, prices and ages are
 * taken out. Cutting at the first dash, as this used to, named every row
 * that starts with a date after the date ("Jun 14").
 */
function nameFrom(text: string, cells?: string[]): string | null {
  if (cells && cells.length > 1) {
    const cell = cells.find(
      (c) => /[a-z]{3}/i.test(c) && !DATEISH.test(c) && !/\$\s?\d|^ages?\b|^grades?\b/i.test(c) && c.length <= 80,
    );
    return cell ?? null;
  }
  if (text.length > 90) return null;
  const DAY = '(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|urday)?s?\\.?';
  const stripped = text
    // dates: ranges, day lists, "week of", ordinals, years
    .replace(new RegExp(`(week\\s+of\\s+)?${MONTH_RE}\\s+\\d{1,2}${ORD}(?:\\s*,\\s*(?:${MONTH_RE}\\s+)?\\d{1,2}${ORD})*(?:\\s*(?:–|—|-|to|through|thru)\\s*(?:${MONTH_RE}\\s+)?\\d{1,2}${ORD})?(?:,?\\s*\\d{4})?`, 'gi'), ' ')
    .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s*(?:–|—|-|to)\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)?/g, ' ')
    // asides, weekdays, times, prices, ages
    .replace(/\([^)]*\)?/g, ' ')
    .replace(new RegExp(`\\b${DAY}(?:\\s*(?:–|—|-|to)\\s*${DAY})?\\b`, 'gi'), ' ')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?\s*(?:–|—|-|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, ' ')
    .replace(/\$\s?\d[\d,.]*/g, ' ')
    .replace(/(ages?|grades?)\s*:?\s*\d{1,2}\s*(?:–|—|-|to)\s*\d{1,2}/gi, ' ')
    // labels that introduce a value rather than name anything
    .replace(/\b(dates?|times?|when|where|location|cost|price|theme)\s*:/gi, ' ');
  const chunk = stripped
    .split(/\s[|:–—-]\s|[|:–—]/)
    .map((c) => c.replace(/\s+/g, ' ').replace(/^[\s,.;()\-]+|[\s,.;()\-]+$/g, ''))
    .find((c) => /[a-z]{3}/i.test(c) && !/^(dates?|times?|only|am|pm|week)$/i.test(c));
  return chunk ?? null;
}

interface Block {
  text: string;
  /** A table row's cells, kept apart: the name, ages and place are each in one. */
  cells?: string[];
}

const NOT_A_SESSION =
  /\b(pricing|price list|offer good|special offer|\d+% off|sale|discount|uniform|pool|open swim|registration (?:opens|closes)|deadline|appreciation|trip schedule|tryouts?|spring (?:schedule|session|semester)|fall (?:schedule|session|semester)|winter|holiday camp)\b/i;

/**
 * Summer is roughly mid-May to early September. Scouty lists summer camps, so a
 * winter break camp or a spring class schedule is noise here, not a session
 * to review.
 */
function inSummer(isoDate: string): boolean {
  const md = isoDate.slice(5);
  return md >= '05-15' && md <= '09-07';
}

/**
 * Shape checks a real session passes. A day camp starts on a weekday; one that
 * starts on a weekend says so (Richmond Debate's "(Sunday - Saturday)"
 * overnight). And a range longer than two weeks is opening hours or a season
 * unless the text calls it a camp, session or program.
 */
function plausibleSession(range: Range, block: string): boolean {
  const start = new Date(`${range.start}T00:00:00Z`);
  const days = (Date.parse(range.end) - Date.parse(range.start)) / 86_400_000;
  const dow = start.getUTCDay();
  // Naming the days ("Monday - Friday", "T-Th 4:00-6:30") is a schedule
  // talking, whatever the range looks like; "Weekdays 10 AM – 8 PM" is hours.
  const namesDays =
    /\b(mon|tue|wed|thu|fri|sat|sun)(day|s|sday|nesday|rsday|urday)?\b|\b[MTWF]\s*[-–]\s*(?:F|Th|Thu|W)\b/i.test(block);
  const residential = /\b(overnight|sleepaway|residential)\b/i.test(block);
  if ((dow === 0 || dow === 6) && !namesDays && !residential) return false;
  if (days > 14 && !namesDays && !/\b(camp|session|program|intensive|institute)\b/i.test(block)) return false;
  return true;
}

/** Readable text blocks: a date and its price usually sit in the same one. */
function blocks(html: string): Block[] {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, noscript').remove();

  const clean = (t: string) => t.replace(/\s+/g, ' ').trim();
  const out: Block[] = [];
  $('li, tr, p, h1, h2, h3, h4, h5, div.card, article, td').each((_, el) => {
    if (el.type === 'tag' && el.name === 'tr') {
      const cells = $(el)
        .children('td, th')
        .map((__, c) => clean($(c).text()))
        .get()
        .filter(Boolean);
      const text = cells.join(' | ');
      if (text.length >= 8 && text.length <= 400) out.push({ text, cells });
      return;
    }
    const text = clean($(el).text());
    if (text.length >= 8 && text.length <= 400) out.push({ text });
  });

  // Longest-first de-duplication: a <li> inside a <div> yields both, and a
  // row's cells are inside the row.
  const seen: string[] = [];
  return out
    .sort((a, b) => b.text.length - a.text.length)
    .filter((b) => {
      if (seen.some((s) => s.includes(b.text))) return false;
      seen.push(b.text);
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
  const all = blocks(html);
  const pageYear = inferPageYear(all.map((b) => b.text).join(' \n '), seasonYear, {
    modifiedAt: pageModifiedAt(html),
  });

  for (const { text: block, cells } of all) {
    // Dates that describe something other than a session: a sale, a pricing
    // season, opening hours, a deadline. On a camp's own schedule page these
    // rarely appear; on the pages discovery lands on for camps with no
    // schedule, they were half of what got through.
    if (NOT_A_SESSION.test(block)) continue;

    const ranges = findRanges(block, pageYear).filter((r) => inSummer(r.start) && plausibleSession(r, block));
    if (!ranges.length) continue;

    const price = findPrice(block);
    const ages = findAges(block, cells);
    const label = nameFrom(block, cells);

    for (const range of ranges) {
      // Name is part of the key: one organisation often runs several programs
      // the same week (James River has three on June 14), and each is a
      // session a parent can book.
      const key = `${range.start}|${range.end}|${(label ?? '').toLowerCase()}`;
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
