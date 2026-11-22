'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { capture } from '@/lib/analytics';
import {
  CHECKIN_TAGS,
  COMMENT_MAX,
  SUMMARY_MIN,
  TAGS_MAX,
  attendedYearOptions,
  checkCheckin,
  type CheckinDraft,
  type CheckinErrors,
  type CheckinSummary,
} from '@/lib/checkins';

type Status = 'idle' | 'sending' | 'sent';

const EMPTY: CheckinDraft = { email: '', attended_year: '', would_return: '', tags: [], comment: '' };

/**
 * "Parents say" on a camp page, and the check-in that feeds it.
 *
 * Shows a camp's summary only once SUMMARY_MIN parents have confirmed, so one
 * parent can't define a camp. Below that, and whenever the parent might add
 * one, it shows the invite. Hidden entirely while email isn't set up: a
 * check-in counts only once its confirm link is clicked.
 */
export default function ParentCheckins({
  campId,
  campName,
  summary,
  enabled,
}: {
  campId: string;
  campName: string;
  summary: CheckinSummary | null;
  enabled: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [draft, setDraft] = useState<CheckinDraft>(EMPTY);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<CheckinErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [notice, setNotice] = useState<'confirmed' | 'expired' | 'error' | null>(null);

  // Back from a confirm link: say so once, then clean the address bar.
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('checkin');
    if (value === 'confirmed' || value === 'expired' || value === 'error') {
      setNotice(value);
      if (value === 'confirmed') capture('checkin_confirmed', { camp_id: campId });
      const url = new URL(window.location.href);
      url.searchParams.delete('checkin');
      window.history.replaceState(null, '', url.toString());
    }
  }, [campId]);

  const showSummary = summary !== null && summary.count >= SUMMARY_MIN;
  if (!enabled && !showSummary && !notice) return null;

  const open = () => {
    capture('checkin_started', { camp_id: campId, camp_name: campName });
    setStatus('idle');
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const set = <K extends keyof CheckinDraft>(key: K, value: CheckinDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const toggleTag = (tag: string) =>
    set('tags', draft.tags.includes(tag) ? draft.tags.filter((t) => t !== tag) : [...draft.tags, tag]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === 'sending') return;
    const checked = checkCheckin(draft);
    if (!checked.clean) {
      setErrors(checked.errors);
      return;
    }
    setStatus('sending');
    setError(null);
    try {
      const response = await fetch(`/api/camps/${campId}/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, company_website: honeypot }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrors(data.errors ?? {});
        setError(data.error ?? 'Something went wrong. Please try again.');
        setStatus('idle');
        return;
      }
      capture('checkin_submitted', {
        camp_id: campId,
        would_return: draft.would_return,
        tag_count: draft.tags.length,
        has_comment: draft.comment.trim().length > 0,
      });
      setStatus('sent');
      setDraft(EMPTY);
    } catch {
      setError('Something went wrong. Please try again.');
      setStatus('idle');
    }
  };

  const pill = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition-colors ${
      on ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
    }`;

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-md">
      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            notice === 'confirmed' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {notice === 'confirmed'
            ? 'Thanks, your check-in is confirmed. It now counts toward this camp’s summary; a comment shows once we’ve reviewed it.'
            : notice === 'expired'
              ? 'That confirm link has expired. Send your check-in again and use the new link within a week.'
              : 'We couldn’t confirm that check-in. Please try again.'}
        </p>
      )}

      {showSummary ? (
        <>
          <h2 className="text-2xl font-bold text-gray-900">Parents say</h2>
          <p className="mt-2 text-gray-700">
            <span className="text-lg font-semibold text-gray-900">
              {summary.wouldReturn} of {summary.count}
            </span>{' '}
            parents would send their child again.
          </p>
          {summary.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {summary.tags.map((t) => (
                <li key={t.id} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800">
                  {t.label} <span className="text-gray-500">· {t.count}</span>
                </li>
              ))}
            </ul>
          )}
          {summary.comments.length > 0 && (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summary.comments.map((c, i) => (
                <li key={i} className="rounded-lg border border-gray-200 p-4">
                  <p className="text-gray-800">&ldquo;{c.text}&rdquo;</p>
                  <p className="mt-2 text-xs text-gray-500">
                    A parent · summer {c.attended_year} · {c.would_return ? 'would send again' : 'would not send again'}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-gray-500">
            From parents who confirmed by email. We post every check-in that follows our{' '}
            <Link href="/terms" className="underline hover:text-gray-700">rules</Link>, positive or negative.
          </p>
        </>
      ) : (
        enabled && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Did your child go here?</h2>
              <p className="text-sm text-gray-600">
                Tell other Richmond parents how {campName} went. It takes a minute.
              </p>
            </div>
          </div>
        )
      )}

      {enabled && (
        <button
          type="button"
          onClick={open}
          className={`${showSummary ? 'mt-4' : 'mt-3'} rounded-full border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50`}
        >
          {showSummary ? 'Add your check-in' : 'Add a check-in'}
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-heading`}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="w-[92vw] max-w-lg rounded-2xl border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/30"
      >
        <div className="relative max-h-[85vh] overflow-y-auto p-6">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 id={`${id}-heading`} className="pr-10 text-lg font-semibold text-gray-900">
            How did {campName} go?
          </h2>

          {status === 'sent' ? (
            <p role="status" className="mt-3 text-sm text-gray-700">
              Check your email and click the link to confirm. Your check-in counts once it&rsquo;s confirmed.
            </p>
          ) : (
            <form onSubmit={submit} noValidate className="mt-4 space-y-5">
              <fieldset>
                <legend className="text-sm font-medium text-gray-900">Would you send your child again?</legend>
                <div className="mt-2 flex gap-2">
                  {(['yes', 'no'] as const).map((v) => (
                    <button key={v} type="button" onClick={() => set('would_return', v)} className={pill(draft.would_return === v)} aria-pressed={draft.would_return === v}>
                      {v === 'yes' ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
                {errors.would_return && <p className="mt-1 text-xs text-red-700">{errors.would_return}</p>}
              </fieldset>

              <label className="block text-sm font-medium text-gray-900">
                Which summer?
                <select
                  value={draft.attended_year}
                  onChange={(e) => set('attended_year', e.target.value)}
                  className="select-pill mt-1 w-full rounded-full border border-gray-300 bg-white py-2 pl-4 pr-10 text-sm font-normal text-gray-900"
                >
                  <option value="">Choose one</option>
                  {attendedYearOptions().map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                {errors.attended_year && <span className="mt-1 block text-xs font-normal text-red-700">{errors.attended_year}</span>}
              </label>

              <fieldset>
                <legend className="text-sm font-medium text-gray-900">
                  Anything that fits? <span className="font-normal text-gray-500">(up to {TAGS_MAX})</span>
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CHECKIN_TAGS.map((t) => (
                    <button key={t.id} type="button" onClick={() => toggleTag(t.id)} className={pill(draft.tags.includes(t.id))} aria-pressed={draft.tags.includes(t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {errors.tags && <p className="mt-1 text-xs text-red-700">{errors.tags}</p>}
              </fieldset>

              <label className="block text-sm font-medium text-gray-900">
                A few words for other parents <span className="font-normal text-gray-500">(optional)</span>
                <textarea
                  rows={3}
                  maxLength={COMMENT_MAX}
                  value={draft.comment}
                  onChange={(e) => set('comment', e.target.value)}
                  placeholder="What should another parent know?"
                  className="mt-1 w-full rounded-2xl border border-gray-300 px-4 py-2 text-sm font-normal text-gray-900"
                />
                <span className="mt-1 flex justify-between text-xs font-normal text-gray-500">
                  <span>Please don&rsquo;t name children or staff. Comments show after a quick review.</span>
                  <span>{draft.comment.length}/{COMMENT_MAX}</span>
                </span>
              </label>

              <label className="block text-sm font-medium text-gray-900">
                Your email
                <input
                  type="email"
                  autoComplete="email"
                  value={draft.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="mt-1 w-full rounded-full border border-gray-300 px-4 py-2 text-sm font-normal text-gray-900"
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  {errors.email ? <span className="text-red-700">{errors.email}</span> : 'Only to confirm it’s you. Never shown, never used for anything else.'}
                </span>
              </label>

              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label>
                  Company website
                  <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </label>
              </div>

              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {status === 'sending' ? 'Sending…' : 'Send check-in'}
                </button>
                <p className="text-xs text-gray-500">
                  By sending, you agree to our <Link href="/terms" className="underline">Terms</Link>.
                </p>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </section>
  );
}
