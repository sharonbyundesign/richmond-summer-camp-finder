import { NextResponse } from 'next/server';
import { loadCampDetail } from '@/lib/campDetail';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
// Never serve a cached Supabase response so DB changes show up immediately.
export const fetchCache = 'force-no-store';

/**
 * One camp with its sessions, interests and provenance.
 *
 * The query itself lives in loadCampDetail, shared with the server-rendered
 * camp page, so the JSON here and the HTML a crawler reads cannot drift apart.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await loadCampDetail(id);

    if (!result.ok) {
      console.error('[camps/:id]', result.error);
      return NextResponse.json(
        { error: result.status === 404 ? 'Camp not found' : 'Unable to load camp details' },
        { status: result.status },
      );
    }

    return NextResponse.json({ camp: result.camp });
  } catch (err) {
    console.error('Unexpected error in camp detail API:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while loading camp details.' },
      { status: 500 },
    );
  }
}
