import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { checkCheckin, type CheckinDraft } from '@/lib/checkins';
import { emailConfigured, escapeHtml, sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PER_SENDER_PER_HOUR = 5;
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * POST /api/camps/[id]/checkins — a parent says how a camp went.
 *
 * Saved unconfirmed and sent a confirm link; it counts toward the camp's
 * summary only after the parent clicks it (/api/checkins/confirm). One per
 * parent, camp and summer: sending again for the same summer replaces the
 * earlier one and needs confirming again.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campId } = await params;
  if (!UUID_RE.test(campId)) return NextResponse.json({ error: 'Camp not found' }, { status: 404 });

  if (!emailConfigured()) {
    return NextResponse.json({ error: 'Check-ins are not open yet.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 });
  }
  // Honeypot: people never see this field. A bot that fills it gets a quiet
  // success and nothing is stored or sent.
  if (text(body.company_website, 200).trim()) return NextResponse.json({ ok: true });

  const draft: CheckinDraft = {
    email: text(body.email, 300),
    attended_year: text(String(body.attended_year ?? ''), 10),
    would_return: body.would_return === 'yes' || body.would_return === 'no' ? body.would_return : '',
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 20).map((t: unknown) => text(t, 40)) : [],
    comment: text(body.comment, 1000),
  };
  const { errors, clean } = checkCheckin(draft);
  if (!clean) {
    return NextResponse.json({ error: 'Please fix the highlighted fields.', errors }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });

  const { data: camp } = await supabase.from('camps').select('id, name').eq('id', campId).single();
  if (!camp) return NextResponse.json({ error: 'Camp not found' }, { status: 404 });
  const campName = (camp as { name: string }).name;

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipHash = sha256(ip);
  const { count, error: rateError } = await supabase
    .from('camp_checkins' as never)
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', new Date(Date.now() - 3_600_000).toISOString());
  if (rateError) {
    console.error('[checkin] rate check failed:', rateError);
    return NextResponse.json({ error: 'Check-ins are not open yet.' }, { status: 503 });
  }
  if ((count ?? 0) >= PER_SENDER_PER_HOUR) {
    return NextResponse.json({ error: 'Please try again later.' }, { status: 429 });
  }

  const token = randomBytes(32).toString('hex');
  const row = {
    camp_id: campId,
    email: clean.email,
    attended_year: clean.attended_year,
    would_return: clean.would_return,
    tags: clean.tags,
    comment: clean.comment,
    comment_status: 'none',
    confirmed_at: null,
    confirm_token_hash: sha256(token),
    reviewed_by: null,
    reviewed_at: null,
    ip_hash: ipHash,
    created_at: new Date().toISOString(),
  };

  // One per parent, camp and summer: replace an earlier one rather than add.
  const { data: existing } = await supabase
    .from('camp_checkins' as never)
    .select('id')
    .eq('camp_id', campId)
    .eq('email', clean.email)
    .eq('attended_year', clean.attended_year)
    .maybeSingle();
  const write = existing
    ? supabase.from('camp_checkins' as never).update(row as never).eq('id', (existing as { id: string }).id)
    : supabase.from('camp_checkins' as never).insert(row as never);
  const { error: writeError } = await write;
  if (writeError) {
    console.error('[checkin] write failed:', writeError);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  const link = `${new URL(request.url).origin}/api/checkins/confirm?token=${token}`;
  const sent = await sendEmail({
    to: clean.email,
    subject: `Confirm your check-in for ${campName}`,
    text: `Thanks for telling other Richmond parents how ${campName} went.\n\nConfirm it here: ${link}\n\nIf you didn't send this, ignore this email and nothing will be posted.\n\nScouty`,
    html: `<p>Thanks for telling other Richmond parents how <strong>${escapeHtml(campName)}</strong> went.</p><p><a href="${link}">Confirm your check-in</a></p><p style="color:#6b7280">If you didn't send this, ignore this email and nothing will be posted.</p><p>Scouty</p>`,
  });
  if (!sent.ok) {
    console.error('[checkin] confirm email failed:', sent.error);
    return NextResponse.json({ error: 'We could not send the confirm email. Please try again.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
