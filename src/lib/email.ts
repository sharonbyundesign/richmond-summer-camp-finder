/**
 * Sending email, through Resend's HTTP API (no SDK needed).
 *
 * Off until both RESEND_API_KEY and EMAIL_FROM are set — e.g.
 * EMAIL_FROM="Scouty <hello@your-domain.com>", a sender on a domain verified in
 * Resend. Anything that depends on email (parent check-ins) stays hidden while
 * this is off, so nothing asks a parent to confirm an email that never comes.
 *
 * Every email we send must carry a postal address and an unsubscribe route
 * before it is anything other than a one-off transactional message; a confirm
 * link the parent asked for is transactional.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: false, error: 'Email is not configured' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, ...message }),
    });
    if (!response.ok) return { ok: false, error: `${response.status} ${await response.text()}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

/** Escapes text for an HTML email body. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
