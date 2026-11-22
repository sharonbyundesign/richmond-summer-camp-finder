'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const SEASON = 2027;
const REVIEWER_KEY = 'scouty:reviewer-name';

type QueueCamp = {
  id: string;
  name: string;
  location: string | null;
  website_url: string | null;
  sessions_in_season: number;
  sessions_stale: number;
  state: 'empty' | 'stale' | 'done';
  /** Proposals nobody has ruled on yet, and whether any came from the camp. */
  waiting?: number;
  waiting_from_camp?: boolean;
};

type Session = {
  id?: string;
  name?: string | null;
  label?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  min_age?: number | null;
  max_age?: number | null;
  price?: number | null;
  verification_status?: string | null;
};

type Source = { id: string; url: string; url_type: string; notes: string | null };

/** A session the extractor staged, waiting for someone to rule on it. */
type Proposal = {
  id: string;
  proposed: Record<string, unknown>;
  validation: { ok: boolean; issues: Array<{ field: string; severity: string; message: string }> } | null;
  confidence: number | null;
  extractor: string | null;
  review_note: string | null;
  status: string;
  /** Set when the camp sent this through its update form (migration 008). */
  submission_id?: string | null;
  submission?: Submission | null;
};

type Submission = {
  contact_name: string;
  contact_email: string;
  contact_role: string | null;
  message: string | null;
  created_at: string;
};

/** Host of a URL without "www.", or null. */
function hostOf(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Does the sender's email belong to the camp's own domain? A match is good
 * evidence the camp sent it; a gmail address is common for small camps and
 * not a red flag on its own, but it is worth a reply before approving.
 */
function senderCheck(email: string, website: unknown): { ok: boolean; text: string } {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const site = hostOf(website);
  if (!site) return { ok: false, text: 'The camp has no website on file to check the email against.' };
  const matches = domain === site || domain.endsWith(`.${site}`) || site.endsWith(`.${domain}`);
  return matches
    ? { ok: true, text: `Email domain matches the camp's website (${site}).` }
    : { ok: false, text: `Email is @${domain}, the camp's website is ${site}. Make sure it is the camp before approving.` };
}

type Draft = {
  name: string;
  start_date: string;
  end_date: string;
  min_age: string;
  max_age: string;
  price: string;
};

const EMPTY_DRAFT: Draft = { name: '', start_date: '', end_date: '', min_age: '', max_age: '', price: '' };

const STATE_STYLE: Record<QueueCamp['state'], string> = {
  empty: 'bg-red-100 text-red-800',
  stale: 'bg-amber-100 text-amber-900',
  done: 'bg-green-100 text-green-800',
};

export default function ReviewClient() {
  const [queue, setQueue] = useState<QueueCamp[]>([]);
  const [counts, setCounts] = useState({ empty: 0, stale: 0, done: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    camp: Record<string, unknown>;
    sessions_in_season: Session[];
    sessions_previous: Session[];
    sources: Source[];
    proposals: Proposal[];
  } | null>(null);

  const [reviewer, setReviewer] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([{ ...EMPTY_DRAFT }]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [warnings, setWarnings] = useState<Array<{ row: number; issues: Array<{ field: string; message: string }> }>>([]);
  /** Reviewer corrections to a staged proposal, keyed by proposal id. */
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [ruling, setRuling] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      setReviewer(localStorage.getItem(REVIEWER_KEY) ?? '');
    } catch {
      // Private mode — the field just starts empty.
    }
  }, []);

  const loadQueue = useCallback(async () => {
    const response = await fetch('/api/review/camps');
    if (!response.ok) return;
    const data = await response.json();
    setQueue(data.camps);
    setCounts(data.counts);
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!selected) return setDetail(null);
    setMessage(null);
    setDrafts([{ ...EMPTY_DRAFT }]);
    setNote('');
    setWarnings([]);
    fetch(`/api/review/camps/${selected}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [selected]);

  const camp = detail?.camp as { name?: string; website_url?: string; location?: string } | undefined;

  const canSave = useMemo(
    () =>
      reviewer.trim().length > 0 &&
      drafts.some((d) => d.start_date && d.end_date) &&
      !saving,
    [reviewer, drafts, saving],
  );

  const setDraft = (i: number, patch: Partial<Draft>) => {
    // Any edit invalidates an acknowledgement for the old values.
    setWarnings([]);
    setDrafts((rows) => rows.map((row, n) => (n === i ? { ...row, ...patch } : row)));
  };

  /** Approve or reject one staged proposal. */
  const rule = async (proposal: Proposal, action: 'approve' | 'reject', acknowledgeWarnings = false) => {
    if (!reviewer.trim()) {
      setRuling((r) => ({ ...r, [proposal.id]: 'Enter your name below first' }));
      return;
    }
    setBusy(proposal.id);
    try {
      localStorage.setItem(REVIEWER_KEY, reviewer.trim());
    } catch {
      // Not worth failing over.
    }

    const response = await fetch('/api/review/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: proposal.id,
        action,
        reviewed_by: reviewer.trim(),
        edits: edits[proposal.id] ?? null,
        acknowledge_warnings: acknowledgeWarnings,
      }),
    });
    const data = await response.json();
    setBusy(null);

    if (response.status === 409 && data.needs_acknowledgement) {
      setRuling((r) => ({
        ...r,
        [proposal.id]: `${data.error}: ${data.warnings.map((w: { message: string }) => w.message).join('; ')}`,
      }));
      // Approving again from here sends the acknowledgement.
      setEdits((e) => ({ ...e, [`${proposal.id}:ack`]: {} as Record<string, string> }));
      return;
    }
    if (!response.ok) {
      const detailText = Array.isArray(data.issues)
        ? data.issues.map((i: { message: string }) => i.message).join('; ')
        : '';
      setRuling((r) => ({ ...r, [proposal.id]: [data.error, detailText].filter(Boolean).join(' — ') }));
      return;
    }

    loadQueue();
    fetch(`/api/review/camps/${selected}`).then((r) => r.json()).then(setDetail);
  };

  const save = async (acknowledgeWarnings = false) => {
    setSaving(true);
    setMessage(null);
    try {
      localStorage.setItem(REVIEWER_KEY, reviewer.trim());
    } catch {
      // Not worth failing the save over.
    }

    const payload = {
      camp_id: selected,
      reviewed_by: reviewer.trim(),
      review_note: note,
      acknowledge_warnings: acknowledgeWarnings,
      source_id: detail?.sources?.[0]?.id ?? null,
      sessions: drafts
        .filter((d) => d.start_date && d.end_date)
        .map((d) => ({
          name: d.name || null,
          start_date: d.start_date,
          end_date: d.end_date,
          min_age: d.min_age === '' ? null : Number(d.min_age),
          max_age: d.max_age === '' ? null : Number(d.max_age),
          price: d.price === '' ? null : Number(d.price),
        })),
    };

    const response = await fetch('/api/review/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);

    if (response.status === 409) {
      setWarnings(data.warnings ?? []);
      setMessage({ tone: 'bad', text: data.error });
      return;
    }

    if (!response.ok && response.status !== 207) {
      const detailText = Array.isArray(data.issues)
        ? data.issues
            .map((i: { row: number; issues: Array<{ message: string }> }) =>
              `row ${i.row}: ${i.issues.map((x) => x.message).join('; ')}`)
            .join(' · ')
        : '';
      setMessage({ tone: 'bad', text: [data.error, detailText].filter(Boolean).join(' — ') });
      return;
    }

    setMessage({
      tone: data.applied === data.total ? 'ok' : 'bad',
      text: `${data.applied} of ${data.total} published${
        data.applied === data.total ? '' : ' — ' + data.results.filter((r: { outcome: string }) => r.outcome !== 'applied')
          .map((r: { row: number; error?: string; outcome: string }) => `row ${r.row}: ${r.error ?? r.outcome}`).join('; ')
      }`,
    });

    setWarnings([]);
    if (data.applied > 0) {
      setDrafts([{ ...EMPTY_DRAFT }]);
      loadQueue();
      fetch(`/api/review/camps/${selected}`).then((r) => r.json()).then(setDetail);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900">
            Session review <span className="font-normal text-gray-500">· {SEASON}</span>
          </h1>
          <p className="text-sm text-gray-600">
            <span className="font-medium text-red-700">{counts.empty} empty</span>
            {' · '}
            <span className="font-medium text-amber-800">{counts.stale} last season only</span>
            {' · '}
            <span className="font-medium text-green-700">{counts.done} done</span>
          </p>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Local tool. Writes straight to the production database and publishes as
          <code className="mx-1 rounded bg-gray-100 px-1">human_checked</code>
          under your name — so only enter dates the camp actually publishes for {SEASON}.
        </p>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-[320px_1fr]">
        <aside className="max-h-[80vh] overflow-y-auto rounded-xl border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {queue.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c.id)}
                  className={`flex w-full items-start justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 ${
                    selected === c.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{c.name}</span>
                    <span className="block truncate text-xs text-gray-500">{c.location ?? '—'}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLE[c.state]}`}>
                      {c.state === 'done' ? `${c.sessions_in_season}` : c.state === 'stale' ? `${c.sessions_stale} old` : '0'}
                    </span>
                    {(c.waiting ?? 0) > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.waiting_from_camp ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {c.waiting} {c.waiting_from_camp ? 'from camp' : 'to review'}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="space-y-5">
          {!detail && (
            <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
              Pick a camp. The queue is ordered worst-first: camps with no sessions at all,
              then camps carrying only last season&rsquo;s.
            </p>
          )}

          {detail && (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-gray-900">{camp?.name}</h2>
                <p className="mt-0.5 text-sm text-gray-500">{camp?.location ?? 'No address on file'}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {camp?.website_url && (
                    <a href={camp.website_url} target="_blank" rel="noopener noreferrer"
                       className="font-medium text-blue-600 hover:underline">
                      Open the camp&rsquo;s site ↗
                    </a>
                  )}
                  {detail.sources.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                       className="text-gray-600 hover:underline">
                      {s.url_type} ↗
                    </a>
                  ))}
                </div>
              </div>

              {detail.sessions_previous.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Last season, for reference ({detail.sessions_previous.length})
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Read-only and deliberately not copied into the form. Last year&rsquo;s dates
                    are not evidence about {SEASON}.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-gray-700">
                    {detail.sessions_previous.map((s) => (
                      <li key={s.id} className="flex flex-wrap gap-x-3">
                        <span className="font-medium">{s.name || s.label || 'Session'}</span>
                        <span className="text-gray-500">{s.start_date} → {s.end_date}</span>
                        {(s.min_age != null || s.max_age != null) && (
                          <span className="text-gray-500">ages {s.min_age ?? '?'}–{s.max_age ?? '?'}</span>
                        )}
                        {s.price != null && <span className="text-gray-500">${s.price}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.sessions_in_season.length > 0 && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                  <h3 className="text-sm font-semibold text-green-900">
                    Published for {SEASON} ({detail.sessions_in_season.length})
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-green-900">
                    {detail.sessions_in_season.map((s) => (
                      <li key={s.id}>
                        {s.name || 'Session'} · {s.start_date} → {s.end_date} · {s.verification_status}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.proposals.length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Waiting for review ({detail.proposals.length})
                  </h3>
                  <p className="mt-1 text-xs text-gray-600">
                    Not published yet. Correct anything that is wrong, then approve. Sessions the
                    extractor found publish as <code>human_checked</code>; sessions the camp sent
                    publish as <code>camp_confirmed</code>, so approve those only once you are sure
                    the sender is the camp.
                  </p>

                  {/* One block per camp submission: who sent it, and whether
                      their email looks like the camp's. */}
                  {Array.from(
                    new Map(
                      detail.proposals
                        .filter((p) => p.submission_id && p.submission)
                        .map((p) => [p.submission_id as string, p.submission as Submission]),
                    ).entries(),
                  ).map(([submissionId, sub]) => {
                    const check = senderCheck(sub.contact_email, detail.camp.website_url);
                    const count = detail.proposals.filter((p) => p.submission_id === submissionId).length;
                    return (
                      <div key={submissionId} className="mt-4 rounded-lg border border-blue-200 bg-white p-3 text-sm">
                        <p className="font-medium text-gray-900">
                          Sent by the camp: {sub.contact_name}
                          {sub.contact_role ? ` (${sub.contact_role})` : ''} ·{' '}
                          <a href={`mailto:${sub.contact_email}`} className="text-blue-700 underline">
                            {sub.contact_email}
                          </a>
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {count} {count === 1 ? 'session' : 'sessions'} · {new Date(sub.created_at).toLocaleString()}
                        </p>
                        <p className={`mt-1 text-xs ${check.ok ? 'text-green-700' : 'text-amber-800'}`}>{check.text}</p>
                        {sub.message && (
                          <p className="mt-2 whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-xs text-gray-700">
                            {sub.message}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  <ul className="mt-4 space-y-3">
                    {detail.proposals.map((p) => {
                      const value = (field: string) =>
                        edits[p.id]?.[field] ??
                        (p.proposed[field] == null ? '' : String(p.proposed[field]));
                      const setField = (field: string, v: string) =>
                        setEdits((e) => ({ ...e, [p.id]: { ...(e[p.id] ?? {}), [field]: v } }));
                      const issues = p.validation?.issues ?? [];

                      return (
                        <li key={p.id} className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="flex flex-wrap items-end gap-2">
                            {([
                              ['name', 'Name', 'text', 'w-40'],
                              ['start_date', 'Start', 'date', 'w-36'],
                              ['end_date', 'End', 'date', 'w-36'],
                              ['min_age', 'Min age', 'number', 'w-20'],
                              ['max_age', 'Max age', 'number', 'w-20'],
                              ['price', 'Price', 'number', 'w-24'],
                            ] as Array<[string, string, string, string]>).map(([field, label, type, width]) => (
                              <label key={field} className="text-xs text-gray-500">
                                <span className="block">{label}</span>
                                <input
                                  type={type}
                                  value={value(field)}
                                  onChange={(e) => setField(field, e.target.value)}
                                  className={`mt-0.5 ${width} rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900`}
                                />
                              </label>
                            ))}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            {p.submission_id ? (
                              <span className="font-medium text-blue-700">from {p.submission?.contact_name ?? 'the camp'}</span>
                            ) : (
                              p.confidence != null && <span>confidence {p.confidence}</span>
                            )}
                            {p.extractor && <span>{p.extractor}</span>}
                            {typeof p.proposed.start_time === 'string' && (
                              <span>
                                {String(p.proposed.start_time)}–{String(p.proposed.end_time ?? '?')}
                              </span>
                            )}
                            {typeof p.proposed.location_id === 'string' && <span>site set</span>}
                            {issues.length > 0 && (
                              <span className="text-amber-800">
                                {issues.map((i) => `${i.field}: ${i.message}`).join(' · ')}
                              </span>
                            )}
                          </div>
                          {p.review_note && (
                            <p className="mt-1 truncate text-xs text-gray-400" title={p.review_note}>
                              {p.review_note}
                            </p>
                          )}

                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => rule(p, 'approve', Boolean(ruling[p.id]))}
                              disabled={busy === p.id}
                              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {busy === p.id ? 'Working…' : ruling[p.id] ? 'Approve anyway' : 'Approve'}
                            </button>
                            <button
                              onClick={() => rule(p, 'reject')}
                              disabled={busy === p.id}
                              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                            {ruling[p.id] && <span className="text-xs text-amber-800">{ruling[p.id]}</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-gray-900">
                  Add {SEASON} sessions by hand
                </h3>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="pb-2 pr-3 font-medium">Name</th>
                        <th className="pb-2 pr-3 font-medium">Start</th>
                        <th className="pb-2 pr-3 font-medium">End</th>
                        <th className="pb-2 pr-3 font-medium">Min age</th>
                        <th className="pb-2 pr-3 font-medium">Max age</th>
                        <th className="pb-2 font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.map((d, i) => (
                        <tr key={i}>
                          {([
                            ['name', 'text', 'Week 1'],
                            ['start_date', 'date', ''],
                            ['end_date', 'date', ''],
                            ['min_age', 'number', ''],
                            ['max_age', 'number', ''],
                            ['price', 'number', ''],
                          ] as Array<[keyof Draft, string, string]>).map(([field, type, placeholder]) => (
                            <td key={field} className="py-1 pr-3">
                              <input
                                type={type}
                                value={d[field]}
                                placeholder={placeholder}
                                onChange={(e) => setDraft(i, { [field]: e.target.value } as Partial<Draft>)}
                                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={() => setDrafts((rows) => [...rows, { ...EMPTY_DRAFT }])}
                  className="mt-3 text-sm font-medium text-blue-600 hover:underline"
                >
                  + another week
                </button>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="block font-medium text-gray-700">Your name (required)</span>
                    <input
                      value={reviewer}
                      onChange={(e) => setReviewer(e.target.value)}
                      placeholder="sharon"
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <span className="mt-1 block text-xs text-gray-500">
                      Published as <code>human_checked</code> under this name. Left blank it would be{' '}
                      <code>auto</code>, so the form refuses.
                    </span>
                  </label>
                  <label className="text-sm">
                    <span className="block font-medium text-gray-700">Where this came from</span>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="emailed schedule, 12 Jan"
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <span className="mt-1 block text-xs text-gray-500">Stored on the proposal as review_note.</span>
                  </label>
                </div>

                <button
                  onClick={() => save(false)}
                  disabled={!canSave}
                  className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Publishing…' : `Publish to ${SEASON}`}
                </button>

                {message && (
                  <p className={`mt-3 text-sm ${message.tone === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
                    {message.text}
                  </p>
                )}

                {warnings.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-900">
                      These look unusual. They are allowed — a camp really can run a week
                      outside the normal summer window — but check them before publishing,
                      because this goes live as verified under your name.
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                      {warnings.map((w) => (
                        <li key={w.row}>
                          <span className="font-medium">Row {w.row}:</span>{' '}
                          {w.issues.map((i) => i.message).join('; ')}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => save(true)}
                      disabled={saving}
                      className="mt-3 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                    >
                      I checked these — publish anyway
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
