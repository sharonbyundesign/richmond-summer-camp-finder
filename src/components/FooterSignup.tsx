'use client';

import { Fragment, useRef } from 'react';
import LaunchSignup from '@/components/LaunchSignup';

/**
 * Footer entry point to the launch waitlist: a quiet one-line trigger that opens
 * the signup in a modal, keeping the form out of the footer until it's wanted.
 *
 * Built on the native <dialog> element so focus trapping, Esc-to-close, and
 * returning focus to the trigger on close come for free. On phones it renders as
 * a bottom sheet (most traffic is mobile via the Facebook in-app browser);
 * `sm:` recenters it as an ordinary dialog on wider screens.
 */
export default function FooterSignup() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    // showModal focuses the first focusable child (the close button); move focus
    // to the email input instead. The content is already in the DOM, so this runs
    // synchronously.
    dialog.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
  };

  const close = () => dialogRef.current?.close();

  return (
    <Fragment>
      <span className="whitespace-nowrap">
        Full launch January 2027 ·{' '}
        <button
          type="button"
          onClick={open}
          className="font-medium text-gray-600 underline underline-offset-2 hover:text-gray-900"
        >
          Get notified
        </button>
      </span>

      <dialog
        ref={dialogRef}
        data-launch-sheet
        aria-labelledby="launch-signup-heading"
        // Native <dialog> reports itself as a modal dialog to assistive tech when
        // opened with showModal(); these make that explicit.
        role="dialog"
        aria-modal="true"
        // A click whose target is the dialog itself landed on the ::backdrop, not
        // the content (which is wrapped below) — treat it as a dismiss.
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="m-0 w-full max-w-full bg-white p-0 text-left shadow-xl backdrop:bg-black/30 fixed inset-x-0 bottom-0 top-auto rounded-t-2xl border border-gray-200 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[92vw] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="relative p-5 sm:p-6">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:text-gray-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 id="launch-signup-heading" className="pr-10 text-lg font-semibold text-gray-900">
            Launching January 2027
          </h2>

          <LaunchSignup source="footer" className="mt-4" />
        </div>
      </dialog>
    </Fragment>
  );
}
