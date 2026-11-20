'use client';

import { useId, useState } from 'react';
import { capture } from '@/lib/analytics';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface LaunchSignupProps {
  /** Placement identifier, stored with the signup and sent to PostHog. */
  source: string;
  className?: string;
}

/**
 * Email capture for the January 2027 full-launch waitlist. Purely additive — the
 * site stays fully usable without it — so a failed or unconfigured backend just
 * shows a retry, never blocks anything.
 */
export default function LaunchSignup({ source, className = '' }: LaunchSignupProps) {
  const inputId = useId();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

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

      capture('launch_signup_completed', { source });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <p
        role="status"
        className={`text-sm font-medium text-gray-700 ${className}`}
      >
        You&apos;re on the list — see you in January!
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
      >
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          Get one email when the full site launches in January
        </label>
        <div className="mt-2 flex gap-2">
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
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'submitting' ? 'Signing up…' : 'Notify me'}
          </button>
        </div>
      </form>

      {status === 'error' ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          Something went wrong. Please check your email and try again.
        </p>
      ) : (
        <p className="mt-2 text-xs text-gray-500">One email at launch. No spam, ever.</p>
      )}
    </div>
  );
}
