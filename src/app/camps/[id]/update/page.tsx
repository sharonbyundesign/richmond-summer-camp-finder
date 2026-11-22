import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { ACTIVE_SEASON_YEAR } from '@/lib/trust';
import CampUpdateForm, { type UpdateFormCamp } from './CampUpdateForm';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type Params = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  name: string;
  camp_locations?: Array<{ id: string; name: string | null; address: string | null; outside_service_area: boolean | null }>;
  camp_sessions?: Array<{ name: string | null; start_date: string; end_date: string; season_year: number | null }>;
};

async function loadCamp(id: string): Promise<UpdateFormCamp | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase
    .from('camps')
    .select('id, name, camp_locations(id, name, address, outside_service_area), camp_sessions(name, start_date, end_date, season_year)')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  if (!data) return null;

  const camp = data as unknown as Row;
  const sessions = (camp.camp_sessions ?? []).slice().sort((a, b) => a.start_date.localeCompare(b.start_date));
  return {
    id: camp.id,
    name: camp.name,
    sites: (camp.camp_locations ?? [])
      .filter((s) => !s.outside_service_area)
      .map((s) => ({ id: s.id, label: s.name || s.address || 'Location' })),
    currentCount: sessions.filter((s) => s.season_year === ACTIVE_SEASON_YEAR).length,
    // Last season's weeks, as a reference the camp can read while typing —
    // never prefilled into the form.
    previous: sessions
      .filter((s) => s.season_year === ACTIVE_SEASON_YEAR - 1)
      .map((s) => ({ name: s.name, start_date: s.start_date, end_date: s.end_date })),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const camp = await loadCamp(id);
  return {
    title: camp ? `Update ${camp.name} · Scouty` : 'Camp not found · Scouty',
    // A form for camp staff, not a page for parents to find in search.
    robots: { index: false, follow: false },
  };
}

export default async function CampUpdatePage({ params }: Params) {
  const { id } = await params;
  const camp = await loadCamp(id);
  if (!camp) notFound();
  return <CampUpdateForm camp={camp} seasonYear={ACTIVE_SEASON_YEAR} />;
}
