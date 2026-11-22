'use client';

import { useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { capture } from '@/lib/analytics';
import { feedbackMailto } from '@/lib/contact';
import {
  CONTACT_ROLES,
  EMPTY_REGISTRATION,
  EMPTY_SESSION,
  MAX_SESSIONS,
  checkContact,
  checkRegistration,
  checkSession,
  isBlank,
  isRegistrationBlank,
  type ContactDraft,
  type FieldErrors,
  type RegistrationDraft,
  type SessionDraft,
} from '@/lib/campSubmission';

export interface UpdateFormCamp {
  id: string;
  name: string;
  sites: Array<{ id: string; label: string }>;
  /** Sessions already published for the season being collected. */
  currentCount: number;
  previous: Array<{ name: string | null; start_date: string; end_date: string }>;
}

type Status = 'idle' | 'sending' | 'sent';

const INPUT =
  'mt-1 w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500';
const INVALID = 'border-red-400';

/** YYYY-MM-DD plus n days, in UTC so no timezone moves the date. */
function shiftDate(iso: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function Field({
  label,
  error,
  className = '',
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm text-gray-700 ${className}`}>
      {label}
      {children}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

/**
 * The camp-facing update form. Everything a camp sends lands in the review
 * queue (camp_updates); nothing is published until a reviewer approves it.
 * Built for a director typing in a run of weekly sessions: "Add next week"
 * copies the last row a week later, so eight weeks is mostly eight clicks.
 */
export default function CampUpdateForm({ camp, seasonYear }: { camp: UpdateFormCamp; seasonYear: number }) {
  const [sessions, setSessions] = useState<SessionDraft[]>([{ ...EMPTY_SESSION }]);
  const [contact, setContact] = useState<ContactDraft>({ name: '', email: '', role: '', message: '' });
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [contactErrors, setContactErrors] = useState<FieldErrors<keyof ContactDraft>>({});
  const [sessionErrors, setSessionErrors] = useState<Array<FieldErrors<keyof SessionDraft>>>([]);
  const [sentCount, setSentCount] = useState(0);
  const [registration, setRegistration] = useState<RegistrationDraft>({ ...EMPTY_REGISTRATION });
  const [regErrors, setRegErrors] = useState<FieldErrors<keyof RegistrationDraft>>({});
  const setReg = (field: keyof RegistrationDraft, value: string) => {
    setRegistration((r) => ({ ...r, [field]: value }));
    setRegErrors((e) => ({ ...e, [field]: undefined }));
  };

  const siteIds = camp.sites.map((s) => s.id);
  const manySites = camp.sites.length > 1;

  const setSession = (index: number, field: keyof SessionDraft, value: string) => {
    setSessions((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setSessionErrors((errs) => errs.map((e, i) => (i === index ? { ...e, [field]: undefined } : e)));
  };

  const addNextWeek = () =>
    setSessions((rows) => {
      const last = rows.at(-1) ?? EMPTY_SESSION;
      return [
        ...rows,
        { ...last, name: '', start_date: shiftDate(last.start_date, 7), end_date: shiftDate(last.end_date, 7) },
      ];
    });

  const addBlank = () => setSessions((rows) => [...rows, { ...EMPTY_SESSION }]);

  const remove = (index: number) => {
    setSessions((rows) => rows.filter((_, i) => i !== index));
    setSessionErrors((errs) => errs.filter((_, i) => i !== index));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === 'sending') return;

    // Same rules the server runs, so most mistakes show before a round trip.
    const cErrors = checkContact(contact);
    const sErrors = sessions.map((row) => (isBlank(row) ? {} : checkSession(row, seasonYear, siteIds).errors));
    const filled = sessions.filter((row) => !isBlank(row)).length;
    const hasRegistration = !isRegistrationBlank(registration);
    const rErrors = hasRegistration ? checkRegistration(registration, seasonYear).errors : {};
    setContactErrors(cErrors);
    setSessionErrors(sErrors);
    setRegErrors(rErrors);
    if (Object.keys(cErrors).length || sErrors.some((e) => Object.keys(e).length) || Object.keys(rErrors).length) {
      setError('Please fix the highlighted fields.');
      return;
    }
    if (filled === 0 && !hasRegistration) {
      setError('Add at least one session, or when registration opens.');
      return;
    }

    setStatus('sending');
    setError(null);
    try {
      const response = await fetch(`/api/camps/${camp.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, sessions, registration, company_website: honeypot }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setContactErrors(data.contact_errors ?? {});
        setSessionErrors(data.session_errors ?? []);
        setRegErrors(data.registration_errors ?? {});
        setError(data.error ?? 'Something went wrong. Please try again.');
        setStatus('idle');
        return;
      }
      capture('camp_update_submitted', { camp_id: camp.id, camp_name: camp.name, session_count: data.session_count });
      setSentCount(data.session_count ?? filled);
      setStatus('sent');
      window.scrollTo({ top: 0 });
    } catch {
      setError('Something went wrong. Please try again.');
      setStatus('idle');
    }
  };

  if (status === 'sent') {
    const firstName = contact.name.trim().split(/\s+/)[0];
    return (
      <main className="min-h-screen bg-gray-50">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">Thanks, {firstName}.</h1>
            <p className="mt-3 text-gray-700">
              We got {sentCount > 0 ? `${sentCount} ${sentCount === 1 ? 'session' : 'sessions'}` : 'your registration date'}{' '}
              for {camp.name}. We check every update before it goes live, usually within a few days, and will email
              you if anything is unclear.
            </p>
            <Link
              href={`/camps/${camp.id}`}
              className="mt-6 inline-block rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Back to {camp.name}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />
      <form onSubmit={submit} noValidate className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href={`/camps/${camp.id}`} className="text-sm text-blue-600 hover:text-blue-800">
          ← {camp.name}
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          Add {camp.name}&rsquo;s {seasonYear} dates
        </h1>
        <p className="mt-3 text-gray-700">
          Richmond parents use Scouty to find summer camps. Add your {seasonYear} sessions and we&rsquo;ll publish
          them after a quick check, usually within a few days. It&rsquo;s free, and there&rsquo;s no account to make.
        </p>
        {camp.currentCount > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            Scouty already shows {camp.currentCount} {seasonYear} {camp.currentCount === 1 ? 'session' : 'sessions'}{' '}
            for you. Add any that are missing, and use the note to tell us what changed.
          </p>
        )}

        {camp.previous.length > 0 && (
          <details className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            <summary className="cursor-pointer font-medium text-gray-900">
              Your {seasonYear - 1} sessions on Scouty ({camp.previous.length}), for reference
            </summary>
            <ul className="mt-2 space-y-0.5">
              {camp.previous.map((s, i) => (
                <li key={`${s.start_date}-${i}`}>
                  {shortDate(s.start_date)} – {shortDate(s.end_date)}
                  {s.name ? ` · ${s.name}` : ''}
                </li>
              ))}
            </ul>
          </details>
        )}

        <h2 className="mt-8 text-lg font-semibold text-gray-900">Your sessions</h2>
        <p className="mt-1 text-sm text-gray-600">
          One row per week or session. Dates are required; add the rest if you have it. Not set yet? Skip
          to registration below.
        </p>

        <ol className="mt-4 space-y-4">
          {sessions.map((row, index) => {
            const errs = sessionErrors[index] ?? {};
            const cls = (field: keyof SessionDraft) => `${INPUT} ${errs[field] ? INVALID : ''}`;
            return (
              <li key={index} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Session {index + 1}</h3>
                  {sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-sm text-gray-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
                  <Field label="Name (optional)" error={errs.name} className="col-span-2 sm:col-span-4">
                    <input
                      value={row.name}
                      onChange={(e) => setSession(index, 'name', e.target.value)}
                      placeholder="e.g. Lego Week, full day"
                      className={cls('name')}
                    />
                  </Field>
                  <Field label="Start date" error={errs.start_date}>
                    <input
                      type="date"
                      value={row.start_date}
                      min={`${seasonYear}-01-01`}
                      max={`${seasonYear}-12-31`}
                      onChange={(e) => setSession(index, 'start_date', e.target.value)}
                      className={cls('start_date')}
                    />
                  </Field>
                  <Field label="End date" error={errs.end_date}>
                    <input
                      type="date"
                      value={row.end_date}
                      min={row.start_date || `${seasonYear}-01-01`}
                      max={`${seasonYear}-12-31`}
                      onChange={(e) => setSession(index, 'end_date', e.target.value)}
                      className={cls('end_date')}
                    />
                  </Field>
                  <Field label="Starts at" error={errs.start_time}>
                    <input
                      type="time"
                      value={row.start_time}
                      onChange={(e) => setSession(index, 'start_time', e.target.value)}
                      className={cls('start_time')}
                    />
                  </Field>
                  <Field label="Ends at" error={errs.end_time}>
                    <input
                      type="time"
                      value={row.end_time}
                      onChange={(e) => setSession(index, 'end_time', e.target.value)}
                      className={cls('end_time')}
                    />
                  </Field>
                  <Field label="Youngest age" error={errs.min_age}>
                    <input
                      inputMode="numeric"
                      value={row.min_age}
                      onChange={(e) => setSession(index, 'min_age', e.target.value)}
                      placeholder="5"
                      className={cls('min_age')}
                    />
                  </Field>
                  <Field label="Oldest age" error={errs.max_age}>
                    <input
                      inputMode="numeric"
                      value={row.max_age}
                      onChange={(e) => setSession(index, 'max_age', e.target.value)}
                      placeholder="12"
                      className={cls('max_age')}
                    />
                  </Field>
                  <Field label="Price ($)" error={errs.price} className={manySites ? '' : 'col-span-2'}>
                    <input
                      inputMode="decimal"
                      value={row.price}
                      onChange={(e) => setSession(index, 'price', e.target.value)}
                      placeholder="350"
                      className={cls('price')}
                    />
                  </Field>
                  {manySites && (
                    <Field label="Location" error={errs.location_id}>
                      <select
                        value={row.location_id}
                        onChange={(e) => setSession(index, 'location_id', e.target.value)}
                        className={`select-pill ${cls('location_id')} pr-10`}
                      >
                        <option value="">Not sure</option>
                        {camp.sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {sessions.length < MAX_SESSIONS && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addNextWeek}
              className="rounded-full border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              + Add the next week
            </button>
            <button
              type="button"
              onClick={addBlank}
              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400"
            >
              + Add a blank session
            </button>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">
          &ldquo;Add the next week&rdquo; copies the last session one week later, times, ages and price included.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-gray-900">When does registration open?</h2>
        <p className="mt-1 text-sm text-gray-600">
          Parents plan around this, especially for camps that fill fast. Send it even if your session dates
          aren&rsquo;t set yet.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
          <Field label="Opens on" error={regErrors.opens_on}>
            <input
              type="date"
              value={registration.opens_on}
              onChange={(e) => setReg('opens_on', e.target.value)}
              className={`${INPUT} ${regErrors.opens_on ? INVALID : ''}`}
            />
          </Field>
          <Field label="At (optional)" error={regErrors.opens_time}>
            <input
              type="time"
              value={registration.opens_time}
              onChange={(e) => setReg('opens_time', e.target.value)}
              className={`${INPUT} ${regErrors.opens_time ? INVALID : ''}`}
            />
          </Field>
          <Field label="Registration link (optional)" error={regErrors.url} className="col-span-2">
            <input
              type="url"
              value={registration.url}
              onChange={(e) => setReg('url', e.target.value)}
              placeholder="https://"
              className={`${INPUT} ${regErrors.url ? INVALID : ''}`}
            />
          </Field>
          <Field label="Anything else? (optional)" error={regErrors.note} className="col-span-2 sm:col-span-4">
            <input
              value={registration.note}
              onChange={(e) => setReg('note', e.target.value)}
              placeholder="e.g. Returning families can register a week early"
              className={`${INPUT} ${regErrors.note ? INVALID : ''}`}
            />
          </Field>
        </div>

        <h2 className="mt-10 text-lg font-semibold text-gray-900">About you</h2>
        <p className="mt-1 text-sm text-gray-600">So we can check this is from {camp.name}, and ask if anything is unclear.</p>
        <div className="mt-4 grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
          <Field label="Your name" error={contactErrors.name}>
            <input
              autoComplete="name"
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
              className={`${INPUT} ${contactErrors.name ? INVALID : ''}`}
            />
          </Field>
          <Field label="Email" error={contactErrors.email}>
            <input
              type="email"
              autoComplete="email"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
              className={`${INPUT} ${contactErrors.email ? INVALID : ''}`}
            />
          </Field>
          <Field label="Your role" error={contactErrors.role}>
            <select
              value={contact.role}
              onChange={(e) => setContact({ ...contact, role: e.target.value })}
              className={`select-pill ${INPUT} pr-10`}
            >
              <option value="">Choose one</option>
              {CONTACT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Anything else? (optional)" error={contactErrors.message} className="sm:col-span-2">
            <textarea
              rows={3}
              value={contact.message}
              onChange={(e) => setContact({ ...contact, message: e.target.value })}
              placeholder="Registration link, discounts, what changed from last year…"
              className="mt-1 w-full rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </Field>
        </div>

        {/* Honeypot: hidden from people and screen readers; bots fill it. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Company website
            <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-6 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-full bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Send for review'}
          </button>
          <p className="text-xs text-gray-500">
            By sending, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-gray-700">
              Terms
            </Link>
            . We use your email only to ask about these dates.{' '}
            <a href={feedbackMailto(`Camp update: ${camp.name}`)} className="underline hover:text-gray-700">
              Questions? Email us
            </a>
          </p>
        </div>
      </form>
    </main>
  );
}
