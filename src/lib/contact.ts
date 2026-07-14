/**
 * The single place the team's inbox is spelled out. Both user-facing feedback links
 * (the camp-detail "Report incorrect info" footnote and the beta banner) build their
 * mailto from here, so the recipients can't drift apart.
 */
export const FEEDBACK_RECIPIENTS = 'scoutyrva@gmail.com';

export function feedbackMailto(subject: string) {
  return `mailto:${FEEDBACK_RECIPIENTS}?subject=${encodeURIComponent(subject)}`;
}
