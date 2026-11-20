'use client';

import { useId, useState } from 'react';
import { capture } from '@/lib/analytics';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface UpdatesSignupProps {
  /** Placement identifier, stored with the signup and sent to PostHog. */
  source: string;
  /**
   * 'inline' is the one-line footer form, which has to stay short because the
   * footer is sticky on desktop and this sits on screen permanently.
   * 'stacked' is the roomier version for in-page placements.
   */
  layout?: 'inline' | 'stacked';
  /**
   * Stable id for the email input. The beta banner's "Get updates" link focuses
   * the footer form by id, which useId's generated value can't promise.
   */
  fieldId?: string;
  className?: string;
}

/**
 * Email capture for occasional camp updates — no cadence is promised, because
 * we aren't in a position to keep one. Purely additive: the site stays fully
 * usable without it, so a failed or unconfigured backend just shows a retry.
 */
export default function UpdatesSignup({
  source,
  layout = 'stacked',
  fieldId,
  className = '',
}: UpdatesSignupProps) {
  const generatedId = useId();
  const inputId = fieldId ?? generatedId;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const inline = layout === 'inline';

  const submit = async () => {
    if (status === 'submitting') return;

    const trimmed = email.trim();
    // Cheap client-side gate; the server validates authoritatively.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('error');
      return;
    }

    setStatus('submitting');
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source }),
      });

      if (!response.ok) {
        setStatus('error');
        return;
      }

      capture('email_signup_completed', { source });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <p role="status" className={`text-sm font-medium text-gray-700 ${className}`}>
        You&apos;re subscribed.
      </p>
    );
  }

  return (
    <div className={className}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={inline ? 'flex flex-wrap items-center gap-2' : undefined}
      >
        <label
          htmlFor={inputId}
          className={
            inline
              ? 'text-sm text-gray-500'
              : 'block text-sm font-medium text-gray-700'
          }
        >
          {/* The inline label drops the verb — the button next to it already
              says "Get updates", and the shorter text keeps the sticky footer
              on one line down to 768px. */}
          {inline ? 'Camp updates by email' : 'Get camp updates by email'}
        </label>
        <div className={inline ? 'flex gap-2' : 'mt-2 flex gap-2'}>
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
            placeholder="you@example.com"
            aria-invalid={status === 'error'}
            aria-describedby={status === 'error' ? `${inputId}-msg` : undefined}
            className={
              inline
                ? 'min-w-0 w-44 rounded-full border border-gray-300 px-3.5 py-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                : 'min-w-0 flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
            }
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className={
              inline
                ? 'shrink-0 rounded-full bg-blue-600 px-4 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
                : 'shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
            }
          >
            {status === 'submitting' ? 'Adding…' : 'Get updates'}
          </button>
        </div>
      </form>

      {status === 'error' ? (
        <p id={`${inputId}-msg`} role="alert" className={`text-sm text-red-700 ${inline ? 'mt-1.5' : 'mt-2'}`}>
          Something went wrong. Please check your email and try again.
        </p>
      ) : (
        // The inline footer form carries no sub-line: the footer is sticky on
        // desktop, and a second line of reassurance there costs more screen
        // than it earns. The stacked version has room for it.
        !inline && (
          <p className="mt-2 text-xs text-gray-500">
            New camps and news, now and then. No spam.
          </p>
        )
      )}
    </div>
  );
}
