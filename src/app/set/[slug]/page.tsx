import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const revalidate = 3600;
import { createAdminClient } from '@/lib/supabase/server';
import type { SetlistTrack } from '@/lib/agents/types';
import { BRAND } from '@/lib/brand';
import { SetView, toDisplayTracks } from '@/components/setdrop/SetView';

const S = {
  bg: '#0A0A0A', surface: '#141414', border: 'rgba(255,255,255,0.07)',
  accent: '#F5A623', accentDim: 'rgba(245,166,35,0.12)',
  text: '#F0F0F0', textSec: '#8A8A8A', textMuted: '#4A4A4A',
  mono: 'var(--font-mono), monospace', display: 'var(--font-display), sans-serif',
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('setlists')
    .select('name, primary_genre, secondary_genre')
    .eq('share_url', slug)
    .eq('is_public', true)
    .single();
  if (!data) return { title: BRAND.name };
  const genre = [data.primary_genre, data.secondary_genre].filter(Boolean).join(' / ');
  const desc = genre ? `${genre} setlist, built with ${BRAND.name}` : `Built with ${BRAND.name}`;
  return {
    title: `${data.name} — ${BRAND.name}`,
    description: desc,
    openGraph: { title: `${data.name} — ${BRAND.name}`, description: desc, siteName: BRAND.name },
  };
}

export default async function PublicSetPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('setlists')
    .select('id, name, primary_genre, secondary_genre, crowd_context, duration_minutes, lineup_slot, created_at, tracks_json, review_notes')
    .eq('share_url', slug)
    .eq('is_public', true)
    .single();

  if (!data) notFound();

  const tracks: SetlistTrack[] = Array.isArray(data.tracks_json) ? (data.tracks_json as SetlistTrack[]) : [];
  const displayTracks = toDisplayTracks(tracks, undefined, data.primary_genre ?? undefined);
  const date = new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const genre = [data.primary_genre, data.secondary_genre].filter(Boolean).join(' / ') || 'Mixed';
  const crowd = data.crowd_context
    ? data.crowd_context.charAt(0).toUpperCase() + data.crowd_context.slice(1).replace('-', ' ')
    : '';
  const dur = data.duration_minutes ? `${data.duration_minutes} min` : '';
  const setInfo: [string, string][] = [
    ['Pool', genre],
    ...(crowd ? [['Crowd', crowd] as [string, string]] : []),
    ...(data.lineup_slot ? [['Slot', data.lineup_slot] as [string, string]] : []),
  ];

  return (
    <div style={{ background: S.bg, minHeight: '100vh', color: S.text }}>
      <div style={{ padding: '20px 40px', borderBottom: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontFamily: S.display, fontSize: 22, letterSpacing: 3,
          color: S.text, textDecoration: 'none' }}>
          {BRAND.logoLeft}<span style={{ color: S.accent }}>{BRAND.logoRight}</span>
        </a>
        <span style={{ fontFamily: S.mono, fontSize: 12, color: S.textMuted, letterSpacing: 1.5 }}>
          Built with {BRAND.name}
        </span>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '64px 40px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: S.mono, fontSize: 12, color: S.textMuted,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{date}</div>
          <h1 style={{ fontFamily: S.display, fontSize: 'clamp(48px,7vw,96px)',
            letterSpacing: 4, margin: '0 0 12px', lineHeight: .95, color: S.text }}>
            {data.name.toUpperCase()}
          </h1>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
            {[genre, crowd, dur, `${tracks.length} tracks`].filter(Boolean).map((v, i) => (
              <span key={i} style={{ fontFamily: S.mono, fontSize: 13, color: S.textSec }}>
                {i > 0 && <span style={{ color: S.textMuted, marginRight: 16 }}>·</span>}
                {v}
              </span>
            ))}
          </div>
        </div>

        <SetView
          tracks={displayTracks}
          reviewNotes={data.review_notes ?? undefined}
          durationLabel={dur || undefined}
          setInfo={setInfo}
          showPersonalization={false}
        />

        <div style={{ height: 40 }} />

        <div style={{ textAlign: 'center', padding: '56px 40px',
          border: `1px solid ${S.border}`, borderRadius: 4,
          background: S.surface, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)', width: 400, height: 200, borderRadius: '50%',
            background: 'radial-gradient(ellipse,rgba(245,166,35,0.06) 0%,transparent 70%)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: S.display, fontSize: 'clamp(28px,4vw,48px)',
              letterSpacing: 3, color: S.text, marginBottom: 16 }}>BUILD YOUR OWN SET</div>
            <div style={{ fontFamily: S.mono, fontSize: 12, color: S.textSec, marginBottom: 28 }}>
              AI-powered setlist planning. Serato library in, ordered set out.
            </div>
            <a href="/" style={{
              display: 'inline-block', background: S.accent, color: S.bg,
              fontFamily: S.mono, fontSize: 13, fontWeight: 600,
              letterSpacing: 1.5, textTransform: 'uppercase',
              padding: '13px 36px', borderRadius: 3, textDecoration: 'none',
            }}>Try {BRAND.name} Free</a>
            <div style={{ marginTop: 14, fontFamily: S.mono, fontSize: 12, color: S.textMuted }}>
              {process.env.NEXT_PUBLIC_APP_URL ?? ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
