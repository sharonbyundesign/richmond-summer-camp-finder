/**
 * Registration extractor: reads when a camp's registration opens from its own
 * public pages. Registration timing is usually one plain sentence ("Summer
 * 2027 registration opens January 15 at 9 AM"), even on sites whose schedules
 * live behind a sign-up portal, so it is a better fit for scraping than
 * sessions.
 *
 * Heuristic and conservative: it reads sentences that talk about registering,
 * pulls dates and times out of them, and only calls registration "open" when
 * the page ties that to the season in question. Its output is a proposal for a
 * person to check, never a row written straight to the site.
 */

export interface RegistrationDraft {
  opens_on: string | null;
  opens_time: string | null;
  priority_opens_on: string | null;
  priority_opens_time: string | null;
  priority_note: string | null;
  /** The camp's own words when there's no exact date ("Mid to late February"). */
  opens_note: string | null;
  status: 'upcoming' | 'open' | 'waitlist' | null;
  registration_url: string | null;
  /** The sentences each value came from, for the reviewer. */
  evidence: string[];
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const monthIndex = (m: string) => MONTHS.findIndex((full) => full.startsWith(m.toLowerCase().replace('.', '').slice(0, 3)));

const REGISTER_WORDS = /\b(regist(?:er|ration|ering)|enroll(?:ment|ing)?|sign[- ]?ups?|applications?)\b/i;
const PRIORITY_WORDS = /\b(returning|members?|priority|early|alumni|current (?:families|students|campers)|community|faculty|staff|siblings?|waitlisted|presale|pre-registration|waitlist-only)\b/i;
const GENERAL_WORDS = /\b(general|public|everyone|all families|non-?members?|open to all|new (?:families|campers|students))\b/i;
// Scouty lists day camps; when a sentence gives both, the day-camp date wins.
const OVERNIGHT_WORDS = /\b(overnight|sleepaway|residential|sleep-away)\b/i;
// "Registration is open", "now open", "Register now" next to the season.
const OPEN_WORDS = /\b(regist(?:ration|er)|enrollment|applications?)\b[^.]{0,40}\b(?:is|are)\s+(?:now\s+)?open\b|\bnow open\b|\bopen now\b|\bregister now\b|\benroll now\b|\bapply now\b/i;
const WAITLIST_WORDS = /\b(waitlist only|wait list only|join the wait ?list|currently full|sold out)\b/i;
// Sentences about deadlines, refunds or the session itself, where a date isn't an opening.
const NOT_OPENING = /\b(deadline|due|closes?|ends?|refund|cancel|withdraw|last day|by\s+(?:jan|feb|mar|apr|may|jun)|until|through|payment|deposit|balance|fee|price|cost)\b|\$\s?\d/i;
const STRONG_OPENING = /\b(?:regist(?:ration|er)|enrollment)\b[^.]{0,30}\bopens?\s+(?:to [a-z ]+\s+)?(?:on\s+)?(?:[a-z]+day,?\s+)?$/i;
const OPEN_VERB = /\b(opens?|opening|begins?|starts?|available|launch(?:es)?|goes live)\b/i;

/** Page text, split into sentence-ish lines at block tags and full stops. */
export function pageSentences(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|td|section|article|br|span|a|button)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&[a-z]+;|&#\d+;/g, ' ');
  const lines = text
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 1);
  // "Nonmember Registration:" on one line, "Opens Friday, January 15" on the
  // next: a label and its value are one sentence.
  const joined: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].endsWith(':') && i + 1 < lines.length && lines[i].length < 60) {
      joined.push(`${lines[i]} ${lines[i + 1]}`);
      i += 1;
    } else joined.push(lines[i]);
  }
  return joined.filter((s) => s.length > 6 && s.length < 400);
}

/** Registration for summer `season` opens between Aug of the year before and June. */
function resolveDate(monthName: string, day: number, year: number | null, season: number): string | null {
  const m = monthIndex(monthName);
  if (m < 0 || day < 1 || day > 31) return null;
  const y = year ?? (m >= 7 ? season - 1 : season);
  const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (iso < `${season - 1}-08-01` || iso > `${season}-06-30`) return null;
  return iso;
}

/** "9 AM", "9:00 a.m.", "7pm", "noon" → "09:00". */
function readTime(s: string): string | null {
  if (/\bnoon\b/i.test(s)) return '12:00';
  const t = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\.?\b/i.exec(s);
  if (!t) return null;
  let h = Number(t[1]) % 12;
  if (t[3].toLowerCase() === 'p') h += 12;
  return `${String(h).padStart(2, '0')}:${t[2] ?? '00'}`;
}

interface DateHit {
  date: string;
  time: string | null;
  index: number;
}

function datesIn(sentence: string, season: number): DateHit[] {
  const re = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d\\d))?`, 'gi');
  const hits: DateHit[] = [];
  for (let m = re.exec(sentence); m; m = re.exec(sentence)) {
    const date = resolveDate(m[1], Number(m[2]), m[3] ? Number(m[3]) : null, season);
    if (!date) continue;
    // A time belongs to this date if it follows within a few words.
    const after = sentence.slice(m.index + m[0].length, m.index + m[0].length + 24);
    hits.push({ date, time: readTime(after), index: m.index });
  }
  return hits;
}

/**
 * Another summer. A year used as a label ("2026 Registration", "Summer Camp
 * 2026") must be the season itself; a bare year in a date may also be the
 * autumn before it, when registration often opens.
 */
function otherSeason(sentence: string, season: number): boolean {
  const labels = Array.from(
    sentence.matchAll(/\b(20\d\d)\s+(?:summer|camps?|registration|season|program)\b|\b(?:summer|camps?|season)\s+(20\d\d)\b/gi),
  ).map((m) => Number(m[1] ?? m[2]));
  if (labels.some((y) => y !== season)) return true;
  const years = (sentence.match(/\b20\d\d\b/g) ?? []).map(Number);
  return years.length > 0 && years.every((y) => y !== season && y !== season - 1);
}

// Not summer camp: fall camp, school-year programs, one-day "school's out" days.
const NOT_SUMMER = /\b(fall|spring break|spring camp|winter|holiday|school'?s out|after-?school|before-?school|back-to-school|enrichments?|extended day|preschool|junior olympic|training program|teams?|tryouts?|league)\b/i;

const PART = '(?:early|mid|late)';
const FULL_MONTH = (m: string) => {
  const i = monthIndex(m);
  return i < 0 ? m : MONTHS[i].charAt(0).toUpperCase() + MONTHS[i].slice(1);
};

/**
 * "Registration will open in mid/late February" → "Mid to late February";
 * "open in Jan/Feb, 2027" → "January or February".
 */
function vagueOpening(sentence: string): string | null {
  const m = new RegExp(
    `\\b(?:regist(?:ration|er)|enrollment|sign[- ]?ups?)\\b[^.]{0,40}?\\b(?:open(?:s|ing)?|begins?|starts?|available)\\b[^.]{0,12}?\\b(?:in\\s+)?` +
      `(?:(${PART})(?:\\s*(?:/|-|to)\\s*(${PART}))?[- ]?\\s*)?${MONTH_RE}(?:\\s*(?:/|or|and|to|-)\\s*${MONTH_RE})?(?!\\s+\\d{1,2}\\b)`,
    'i',
  ).exec(sentence);
  if (!m) return null;
  const [, part1, part2, month1, month2] = m;
  const parts = [part1, part2].filter(Boolean).map((p) => p.toLowerCase());
  const months = [month1, month2].filter(Boolean).map(FULL_MONTH);
  const lead = parts.length ? `${parts.join(' to ')} ` : '';
  const phrase = `${lead}${months.join(' or ')}`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export function extractRegistration(html: string, season: number, baseUrl?: string, today: string = new Date().toISOString().slice(0, 10)): RegistrationDraft {
  const draft: RegistrationDraft = {
    opens_on: null,
    opens_time: null,
    priority_opens_on: null,
    priority_opens_time: null,
    priority_note: null,
    opens_note: null,
    status: null,
    registration_url: null,
    evidence: [],
  };

  const sentences = pageSentences(html);
  const pageMentionsSeason = sentences.some((s) => s.includes(String(season)));

  sentences.forEach((sentence, i) => {
    if (!REGISTER_WORDS.test(sentence) || otherSeason(sentence, season) || NOT_SUMMER.test(sentence)) return;
    // The season is often in a heading just above ("Summer 2027") rather than the sentence.
    const nearby = sentences.slice(Math.max(0, i - 3), i + 2).join(' ');
    const seasonNearby = nearby.includes(String(season)) || (pageMentionsSeason && !otherSeason(nearby, season));

    const hits = datesIn(sentence, season);
    // "…will not open until registration opens on February 2": the words right
    // before a date settle it, whatever else the sentence says.
    const strong = hits.some((h) => STRONG_OPENING.test(sentence.slice(0, h.index)));
    if (hits.length && (strong || !NOT_OPENING.test(sentence)) && OPEN_VERB.test(sentence)) {
      // Each date's own stretch of the sentence, from the previous date to the
      // next: "opens December 1 for returning families, December 3 for…, and
      // December 4 for new families" gives each date its own who.
      const segments = hits.map((hit, n) => ({
        hit,
        before: sentence.slice(n === 0 ? 0 : hits[n - 1].index, hit.index),
        own: sentence.slice(n === 0 ? 0 : hits[n - 1].index, n + 1 < hits.length ? hits[n + 1].index : sentence.length),
      }));
      const someDay = segments.some((g) => !OVERNIGHT_WORDS.test(g.own));
      for (const { hit, before, own } of segments) {
        // An opening says so before its date ("Opens Friday, January 8"), or
        // leads the sentence ("December 1, 2026, at 5 p.m.: Registration opens").
        // A date in a session range ("March 4 – March 13") does neither.
        if (!OPEN_VERB.test(before) && hit.index > 4) continue;
        if (someDay && OVERNIGHT_WORDS.test(own)) continue;
        const priority = PRIORITY_WORDS.test(own) && !GENERAL_WORDS.test(own);
        if (priority) {
          if (draft.priority_opens_on) continue;
          draft.priority_opens_on = hit.date;
          draft.priority_opens_time = hit.time;
          const who = PRIORITY_WORDS.exec(own)?.[0] ?? '';
          draft.priority_note = who ? `${who.charAt(0).toUpperCase()}${who.slice(1)} families` : 'Early registration';
          draft.evidence.push(sentence);
        } else if (!draft.opens_on) {
          draft.opens_on = hit.date;
          draft.opens_time = hit.time;
          draft.evidence.push(sentence);
        }
      }
      return;
    }

    if (!draft.opens_on && !draft.opens_note) {
      const vague = vagueOpening(sentence);
      if (vague) {
        draft.opens_note = vague;
        draft.evidence.push(sentence);
        return;
      }
    }

    const seasonClose = sentences.slice(Math.max(0, i - 2), i + 1).join(' ').includes(String(season));
    const bareButton = /^(register|enroll|apply|sign up)( here| now| today)?!?$/i.test(sentence);
    if (!draft.status && seasonClose && !bareButton && OPEN_WORDS.test(sentence) && !/\b(will|soon|coming|opens? on|opening)\b/i.test(sentence)) {
      draft.status = 'open';
      draft.evidence.push(sentence);
    } else if (!draft.status && seasonNearby && WAITLIST_WORDS.test(sentence)) {
      draft.status = 'waitlist';
      draft.evidence.push(sentence);
    }
  });

  // An early window found with no general date reads as the only opening.
  if (draft.priority_opens_on && draft.opens_on && draft.priority_opens_on >= draft.opens_on) {
    // "Early" came after the general date: the words misled us. Keep the general one.
    draft.priority_opens_on = null;
    draft.priority_opens_time = null;
    draft.priority_note = null;
  }
  // An exact date makes the vague "in January" redundant.
  if (draft.opens_on) draft.opens_note = null;
  draft.status = settleStatus(draft, today);

  // The page's own registration link, for the "Registration page" button.
  const links = html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const [, href, inner] of Array.from(links)) {
    const label = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/\b(register|registration|enroll|sign up)\b/i.test(label) || label.length > 60) continue;
    try {
      const url = new URL(href, baseUrl);
      if (/^https?:$/.test(url.protocol)) {
        draft.registration_url = url.toString();
        break;
      }
    } catch {
      // Not a usable URL; try the next link.
    }
  }

  return draft;
}

/**
 * A date still ahead beats a "Register now" button: sites keep last summer's
 * button up, and an early window for members isn't open to everyone.
 */
export function settleStatus(d: Pick<RegistrationDraft, 'opens_on' | 'priority_opens_on' | 'opens_note' | 'status'>, today: string): RegistrationDraft['status'] {
  const ahead = d.opens_on ? d.opens_on > today : Boolean(d.priority_opens_on && d.priority_opens_on > today);
  if (ahead) return 'upcoming';
  if (d.status) return d.status;
  if (d.opens_on && d.opens_on <= today) return 'open';
  return d.opens_on || d.priority_opens_on || d.opens_note ? 'upcoming' : null;
}

/** True when the draft says anything worth a reviewer's time. */
export function hasRegistrationInfo(d: RegistrationDraft): boolean {
  return Boolean(d.opens_on || d.priority_opens_on || d.opens_note || d.status === 'open' || d.status === 'waitlist');
}
