import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import type { EmailSignup } from '@/types/database';

// Force dynamic rendering — this route writes on every request.
export const dynamic = 'force-dynamic';

// Pragmatic email check: exactly one @, non-empty local part, a dotted domain, no
// spaces. Deliberately lenient — the goal is to reject obvious typos server-side,
// not to fully validate deliverability.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/signup — add an address to the camp-updates email list.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const rawEmail = typeof body?.email === 'string' ? body.email : '';
    const source = typeof body?.source === 'string' ? body.source : null;

    // Normalize before validating and inserting so the unique index does the
    // deduping we expect (e.g. " Foo@Bar.com " and "foo@bar.com" collide).
    const email = rawEmail.trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // The project's hand-written Database type only models reads, so typed inserts
    // resolve to `never`. Keep the payload checked with `satisfies` and cast only
    // at the call boundary.
    const row = { email, source } satisfies Omit<EmailSignup, 'id' | 'created_at'>;
    const { error } = await supabase.from('email_signups').insert(row as never);

    // 23505 = unique_violation: the address is already on the list. That's the
    // desired end state, so report success rather than surface a duplicate error.
    if (error && error.code !== '23505') {
      console.error('Error inserting email signup:', error);
      return NextResponse.json({ error: 'Unable to sign up' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error in signup API:', err);
    return NextResponse.json({ error: 'Unable to sign up' }, { status: 500 });
  }
}
