import type { TrustBadge as TrustBadgeData, TrustTone } from '@/lib/trust';

// Tailwind only generates classes it finds in src/app, src/components and
// src/pages (tailwind.config.ts). These live here rather than beside the tone
// definition in src/lib/trust.ts for that reason — a class string in lib/ is
// never compiled and the pill renders with no background at all.
const TONE_CLASSES: Record<TrustTone, string> = {
  confirmed: 'bg-green-100 text-green-800 ring-green-600/20',
  checked: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  stale: 'bg-amber-100 text-amber-900 ring-amber-600/20',
  unverified: 'bg-gray-100 text-gray-700 ring-gray-500/20',
};

/**
 * The provenance pill. Renders nothing when there is nothing worth saying —
 * including before migration 001 is applied, when the API returns no trust
 * fields at all. A badge every card carries identically is chrome, not
 * information, so trustBadge() returns null in those cases rather than
 * inventing a reassuring label.
 */
export default function TrustBadge({
  badge,
  className = '',
}: {
  badge: TrustBadgeData | null;
  className?: string;
}) {
  if (!badge) return null;

  return (
    <span
      title={badge.detail}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        TONE_CLASSES[badge.tone]
      } ${className}`}
    >
      {badge.label}
    </span>
  );
}
