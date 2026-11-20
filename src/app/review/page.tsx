import { notFound } from 'next/navigation';
import ReviewClient from './ReviewClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Session review · Scouty', robots: { index: false, follow: false } };

/**
 * Local-only. The review tool writes to the production database with the
 * service-role key, so a deployed build serves 404 here and from every
 * /api/review route (see src/lib/review/guard.ts). Run `npm run dev` and open
 * http://localhost:3000/review.
 */
export default function ReviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ReviewClient />;
}
