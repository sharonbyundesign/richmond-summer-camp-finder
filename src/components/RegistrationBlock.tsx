'use client';

import { capture } from '@/lib/analytics';
import {
  currentRegistration,
  downloadIcs,
  googleCalendarUrl,
  registrationPill,
  remindersFor,
  shortDate,
  shortTime,
} from '@/lib/registration';
import type { CampRegistration } from '@/types/camp';

/**
 * When a camp's registration opens, on its page, with a calendar reminder for
 * that moment. For camps that fill within hours, this is the part of the page
 * a parent acts on in January. Hidden when we know nothing about it.
 */
export default function RegistrationBlock({
  camp,
}: {
  camp: { id: string; name: string; camp_registrations?: CampRegistration[] };
}) {
  const reg = currentRegistration(camp);
  const pill = registrationPill(reg);
  if (!reg || (!pill && !reg.fills_fast && !reg.registration_url)) return null;

  const reminders = remindersFor(camp);
  const general = reminders.find((r) => !r.uid.endsWith('-priority'));
  const when = (date: string, time?: string | null) =>
    `${shortDate(date, true)}${time ? ` at ${shortTime(time)}` : ''}`;

  return (
    <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Registration</h2>
        {reg.fills_fast && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
            <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M11.3 1.05a.75.75 0 01.45.82L10.9 7h4.35a.75.75 0 01.56 1.25l-7.5 8.5a.75.75 0 01-1.3-.62L7.85 11H3.5a.75.75 0 01-.56-1.25l7.5-8.5a.75.75 0 01.86-.2z" /></svg>
            Fills fast
          </span>
        )}
      </div>

      <ul className="mt-2 space-y-1 text-sm text-gray-800">
        {reg.priority_opens_on && (
          <li>
            <span className="font-medium">{when(reg.priority_opens_on, reg.priority_opens_time)}</span>
            {' · '}
            {reg.priority_note ?? 'Early registration'}
          </li>
        )}
        {reg.opens_on && (
          <li>
            <span className="font-medium">{when(reg.opens_on, reg.opens_time)}</span>
            {' · '}
            {reg.priority_opens_on ? 'Opens to everyone' : 'Registration opens'}
          </li>
        )}
        {!reg.opens_on && pill && <li className="font-medium">{pill.text}</li>}
        {reg.opens_note && reg.opens_on && <li className="text-gray-600">{reg.opens_note}</li>}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {reminders.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => {
                downloadIcs(reminders, `${camp.name.replace(/[^\w]+/g, '-').toLowerCase()}-registration.ics`);
                capture('registration_reminder_added', { camp_id: camp.id, kind: 'ics', count: reminders.length });
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Add to calendar
            </button>
            {general && (
              <a
                href={googleCalendarUrl(general)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => capture('registration_reminder_added', { camp_id: camp.id, kind: 'google', count: 1 })}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400"
              >
                Google Calendar
              </a>
            )}
          </>
        )}
        {reg.registration_url && (
          <a
            href={reg.registration_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => capture('registration_link_clicked', { camp_id: camp.id, state: pill?.state ?? 'unknown' })}
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            {pill?.state === 'open' ? 'Register now ↗' : 'Registration page ↗'}
          </a>
        )}
      </div>
      {reminders.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          The reminder goes off the day before{reminders.some((r) => r.time) ? ' and 15 minutes before it opens' : ''}.
        </p>
      )}
    </div>
  );
}
