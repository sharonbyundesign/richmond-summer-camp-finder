'use client';

import Link from 'next/link';
import { capture } from '@/lib/analytics';
import {
  currentRegistration,
  downloadIcs,
  registrationPill,
  remindersFor,
  shortDate,
  shortTime,
  todayInRichmond,
} from '@/lib/registration';
import type { CampRegistration } from '@/types/camp';

type PlanCamp = { id: string; name: string; camp_registrations?: CampRegistration[] };

/**
 * "Your registration plan" on the Saved page: the saved camps whose
 * registration date we know, soonest first, with one button that puts every
 * opening in the person's calendar. Turns a list of favorites into a plan for
 * January, when popular camps fill within hours.
 */
export default function RegistrationPlan({ camps }: { camps: PlanCamp[] }) {
  const today = todayInRichmond();
  const rows = camps
    .map((camp) => {
      const reg = currentRegistration(camp);
      const pill = registrationPill(reg, today);
      if (!reg || !pill) return null;
      const next = [
        reg.priority_opens_on ? { date: reg.priority_opens_on, time: reg.priority_opens_time, label: reg.priority_note ?? 'Early registration' } : null,
        reg.opens_on ? { date: reg.opens_on, time: reg.opens_time, label: reg.priority_opens_on ? 'Everyone' : 'Opens' } : null,
      ].filter((w): w is { date: string; time: string | null | undefined; label: string } => Boolean(w) && w!.date > today);
      return { camp, reg, pill, next, sortKey: next[0]?.date ?? (pill.state === 'open' ? '0000' : '9999') };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  if (rows.length === 0) return null;
  const reminders = rows.flatMap((r) => remindersFor(r.camp, today));

  return (
    <section className="mb-12 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your registration plan</h2>
          <p className="mt-1 text-sm text-gray-600">When registration opens for the camps you saved, soonest first.</p>
        </div>
        {reminders.length > 0 && (
          <button
            type="button"
            onClick={() => {
              downloadIcs(reminders, 'scouty-registration-plan.ics');
              capture('registration_reminder_added', { kind: 'ics-plan', count: reminders.length });
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Add all to calendar ({reminders.length})
          </button>
        )}
      </div>

      <ul className="mt-4 divide-y divide-gray-100">
        {rows.map(({ camp, reg, pill, next }) => (
          <li key={camp.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            {/* The arrow says "this is a link" without making the name blue. */}
            <Link
              href={`/camps/${camp.id}`}
              className="group inline-flex items-center gap-1 font-medium text-gray-900 hover:text-blue-700"
            >
              {camp.name}
              <svg
                aria-hidden="true"
                className="h-4 w-4 flex-shrink-0 text-gray-400 transition-colors group-hover:text-blue-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M9 7h8v8" />
              </svg>
            </Link>
            <span className="text-sm text-gray-700">
              {next.length > 0
                ? next.map((w) => `${shortDate(w.date, true)}${w.time ? ` ${shortTime(w.time)}` : ''} · ${w.label}`).join('  |  ')
                : pill.text}
              {reg.fills_fast && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800"><svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M11.3 1.05a.75.75 0 01.45.82L10.9 7h4.35a.75.75 0 01.56 1.25l-7.5 8.5a.75.75 0 01-1.3-.62L7.85 11H3.5a.75.75 0 01-.56-1.25l7.5-8.5a.75.75 0 01.86-.2z" /></svg>Fills fast</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
