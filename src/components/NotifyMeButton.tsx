'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { capture } from '@/lib/analytics';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface NotifyMeButtonProps {
  campId: string;
  campName: string;
  /** The season being waited on — ACTIVE_SEASON_YEAR from the caller. */
  seasonYear: number;
  className?: string;
}

/**
 * "Notify me when the 2027 dates are posted", for a camp we only hold last
 * season's schedule for.
 *
 * Native <dialog> rather than a hand-rolled modal: showModal() gives focus
 * trapping, Esc to close and a proper backdrop, and returns focus to the
 * button when it closes.
 *
 * No consent checkbox: US email law (CAN-SPAM) is opt-out, and typing your
 * address and pressing "Notify me" is the request itself. What it does
 * require is that the promise is stated plainly, which the line under the
 * field does, and that every email we send carries a postal address and a
 * working unsubscribe.
 */
export default function NotifyMeButton({ campId, campName, seasonYear, className = '' }: NotifyMeButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputId = useId();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const open = () => {
    dialogRef.current?.showModal();
    // showModal focuses the first focusable child (the close button); the
    // field is what they came to fill in.
    dialogRef.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
  };
  const close = () => dialogRef.current?.close();

  const submit = async () => {
    if (status === 'submitting') return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('error');
      return;
    }

    setStatus('submitting');
    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, camp_id: campId }),
      });
      if (!response.ok) {
        setStatus('error');
        return;
      }
      capture('camp_notify_requested', { camp_id: campId, camp_name: campName, season: seasonYear });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={`inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 ${className}`}
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        Notify me when {seasonYear} dates are posted
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${inputId}-heading`}
        // A click whose target is the dialog itself landed on the backdrop.
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="w-[92vw] max-w-md rounded-2xl border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/30"
      >
        <div className="relative p-6">
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

          <h2 id={`${inputId}-heading`} className="pr-10 text-lg font-semibold text-gray-900">
            Get {campName}&rsquo;s {seasonYear} dates
          </h2>

          {status === 'success' ? (
            <p role="status" className="mt-3 text-sm text-gray-700">
              Done. We&rsquo;ll email you once when {campName} posts its {seasonYear} schedule.
            </p>
          ) : (
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id={inputId}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  placeholder="Enter your email"
                  aria-invalid={status === 'error'}
                  className="min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {status === 'submitting' ? 'Saving…' : 'Notify me'}
                </button>
              </div>

              {status === 'error' ? (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  Something went wrong. Please check your email and try again.
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-500">
                  One email when these dates are posted. Unsubscribe anytime.{' '}
                  <Link href="/privacy" className="underline hover:text-gray-700">
                    Privacy Policy
                  </Link>
                </p>
              )}
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
