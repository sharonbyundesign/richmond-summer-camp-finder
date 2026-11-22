import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { ACTIVE_SEASON_YEAR } from '@/lib/trust';
import { stagingStatusFor, toValidationJson, validateSession } from '@/lib/validation/campData';
import {
  MAX_SESSIONS,
  checkContact,
  checkRegistration,
  checkSession,
  isBlank,
  isRegistrationBlank,
  type ContactDraft,
  type RegistrationDraft,
  type SessionDraft,
} from '@/lib/campSubmission';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Per sender per hour, and per camp per day — generous for a real camp, a wall for a script. */
const PER_SENDER_PER_HOUR = 5;
const PER_CAMP_PER_DAY = 20;

/** Migration 008 not applied yet: say so plainly rather than "something went wrong". */
const isMissingTable = (error: { code?: string } | null | undefined) =>
  error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST204';
const notOpen = () => NextResponse.json(
  { error: 'Updates are not open yet. Please email us your dates instead.' },
  { status: 503 },
);

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');

function asSession(raw: unknown): SessionDraft {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    name: text(r.name, 200),
    start_date: text(r.start_date, 20),
    end_date: text(r.end_date, 20),
    start_time: text(r.start_time, 10),
    end_time: text(r.end_time, 10),
    min_age: text(r.min_age, 10),
    max_age: text(r.max_age, 10),
    price: text(r.price, 20),
    location_id: text(r.location_id, 40),
  };
}

/**
 * POST /api/camps/[id]/updates — a camp sends its sessions for the coming season.
 *
 * Nothing here is published. Each session becomes a camp_updates 'insert'
 * proposal, the same queue the extractor fills, and only a reviewer's approval
 * puts it in front of parents (as camp_confirmed — migration 008). The contact
 * details go to camp_submissions, which the anon key cannot read.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campId } = await params;
  if (!UUID_RE.test(campId)) {
    return NextResponse.json({ error: 'Camp not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 });
  }

  // Honeypot: a field people never see. A bot that fills it gets a quiet
  // success and nothing is stored.
  if (text(body.company_website, 200).trim()) {
    return NextResponse.json({ ok: true, session_count: 0 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { data: campData, error: campError } = await supabase
    .from('camps')
    .select('id, camp_locations(id, outside_service_area)')
    .eq('id', campId)
    .single();
  if (campError || !campData) {
    return NextResponse.json({ error: 'Camp not found' }, { status: 404 });
  }
  const camp = campData as unknown as {
    camp_locations?: Array<{ id: string; outside_service_area: boolean | null }>;
  };
  const siteIds = (camp.camp_locations ?? []).filter((s) => !s.outside_service_area).map((s) => s.id);

  // Validate everything before writing anything.
  const contact: ContactDraft = {
    name: text(body.contact?.name, 200).trim(),
    email: text(body.contact?.email, 300).trim().toLowerCase(),
    role: text(body.contact?.role, 60),
    message: text(body.contact?.message, 4000).trim(),
  };
  const contactErrors = checkContact(contact);

  const rawSessions: unknown[] = Array.isArray(body.sessions) ? body.sessions : [];
  const rows: SessionDraft[] = rawSessions.slice(0, MAX_SESSIONS + 1).map(asSession);
  if (rows.length > MAX_SESSIONS) {
    return NextResponse.json({ error: `Send up to ${MAX_SESSIONS} sessions at a time.` }, { status: 400 });
  }
  const checked = rows.map((row) =>
    isBlank(row) ? null : checkSession(row, ACTIVE_SEASON_YEAR, siteIds),
  );
  const sessionErrors = checked.map((c) => c?.errors ?? {});
  const proposals = checked.flatMap((c) => (c?.proposed ? [c.proposed] : []));

  const regDraft: RegistrationDraft = {
    opens_on: text(body.registration?.opens_on, 20),
    opens_time: text(body.registration?.opens_time, 10),
    note: text(body.registration?.note, 400),
    url: text(body.registration?.url, 600),
  };
  const registration = isRegistrationBlank(regDraft) ? null : checkRegistration(regDraft, ACTIVE_SEASON_YEAR);

  const hasErrors =
    Object.keys(contactErrors).length > 0 ||
    sessionErrors.some((e) => Object.keys(e).length > 0) ||
    Boolean(registration && !registration.clean);
  if (hasErrors) {
    return NextResponse.json(
      {
        error: 'Please fix the highlighted fields.',
        contact_errors: contactErrors,
        session_errors: sessionErrors,
        registration_errors: registration?.errors ?? {},
      },
      { status: 400 },
    );
  }
  // A camp may know when registration opens before its dates are set.
  if (proposals.length === 0 && !registration?.clean) {
    return NextResponse.json({ error: 'Add at least one session, or when registration opens.' }, { status: 400 });
  }

  // Rate limits. The IP is only ever stored hashed.
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipHash = createHash('sha256').update(ip).digest('hex');
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [bySender, byCamp] = await Promise.all([
    supabase.from('camp_submissions').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', hourAgo),
    supabase.from('camp_submissions').select('id', { count: 'exact', head: true }).eq('camp_id', campId).gte('created_at', dayAgo),
  ]);
  if (bySender.error || byCamp.error) {
    const failure = bySender.error ?? byCamp.error;
    console.error('[camp-update] rate check failed:', failure);
    return isMissingTable(failure) ? notOpen() : NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
  if ((bySender.count ?? 0) >= PER_SENDER_PER_HOUR || (byCamp.count ?? 0) >= PER_CAMP_PER_DAY) {
    return NextResponse.json(
      { error: 'We have several updates from you already. Please try again later, or email us.' },
      { status: 429 },
    );
  }

  const reg = registration?.clean ?? null;
  const base = {
    camp_id: campId,
    contact_name: contact.name,
    contact_email: contact.email,
    contact_role: contact.role || null,
    message: contact.message || null,
    season_year: ACTIVE_SEASON_YEAR,
    session_count: proposals.length,
    ip_hash: ipHash,
  };
  const insertSubmission = (row: Record<string, unknown>) =>
    supabase.from('camp_submissions').insert(row as never).select('id').single();
  let { data: submission, error: submissionError } = await insertSubmission(
    reg
      ? { ...base, registration_opens_on: reg.opens_on, registration_opens_time: reg.opens_time, registration_note: reg.note, registration_url: reg.url }
      : base,
  );
  // Before migration 010 there are no registration columns: keep what the
  // camp told us by folding it into the note instead of losing it.
  if (reg && submissionError && (submissionError.code === 'PGRST204' || submissionError.code === '42703')) {
    const said = [
      reg.opens_on && `opens ${reg.opens_on}${reg.opens_time ? ` ${reg.opens_time}` : ''}`,
      reg.note,
      reg.url,
    ].filter(Boolean).join(' · ');
    ({ data: submission, error: submissionError } = await insertSubmission({
      ...base,
      message: [base.message, `Registration: ${said}`].filter(Boolean).join('\n'),
    }));
  }
  if (submissionError || !submission) {
    console.error('[camp-update] submission insert failed:', submissionError);
    return isMissingTable(submissionError) ? notOpen() : NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
  const submissionId = (submission as { id: string }).id;

  // Each session is its own proposal. The reviewer-facing rules run here too:
  // an unusual price or a week outside summer is stored as a warning and sends
  // the row to needs_review, rather than bouncing the camp's form.
  const updates = proposals.map((proposed) => {
    const result = validateSession(proposed, ACTIVE_SEASON_YEAR);
    return {
      camp_id: campId,
      target_table: 'camp_sessions',
      change_type: 'insert',
      season_year: ACTIVE_SEASON_YEAR,
      proposed,
      validation: toValidationJson(result),
      status: stagingStatusFor(result),
      extractor: 'camp_form/1',
      submission_id: submissionId,
    };
  });

  const { error: updatesError } = updates.length
    ? await supabase.from('camp_updates').insert(updates as never)
    : { error: null };
  if (updatesError) {
    console.error('[camp-update] proposals insert failed:', updatesError);
    // Leave nothing half-written: a submission with no sessions is noise.
    await supabase.from('camp_submissions').delete().eq('id', submissionId);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, session_count: proposals.length, registration: Boolean(reg) });
}
