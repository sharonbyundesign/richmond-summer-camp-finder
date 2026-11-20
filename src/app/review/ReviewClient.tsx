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
  } | null>(null);

  const [reviewer, setReviewer] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([{ ...EMPTY_DRAFT }]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

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

  const setDraft = (i: number, patch: Partial<Draft>) =>
    setDrafts((rows) => rows.map((row, n) => (n === i ? { ...row, ...patch } : row)));

  const save = async () => {
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
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLE[c.state]}`}>
                    {c.state === 'done' ? `${c.sessions_in_season}` : c.state === 'stale' ? `${c.sessions_stale} old` : '0'}
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

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-gray-900">Add {SEASON} sessions</h3>

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
                  onClick={save}
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
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
