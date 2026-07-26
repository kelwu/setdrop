import { notFound, redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/server';
import type { CrateTrack } from '@/lib/crates/types';

export const dynamic = 'force-dynamic';

const S = {
  bg: '#0A0A0A', surface: '#141414', surface2: '#1A1A1A', border: 'rgba(255,255,255,0.07)',
  accent: '#F5A623', accentDim: 'rgba(245,166,35,0.12)',
  text: '#F0F0F0', textSec: '#8A8A8A', textMuted: '#4A4A4A',
  mono: 'var(--font-mono), monospace', display: 'var(--font-display), sans-serif',
};

type Props = { params: Promise<{ id: string }> };

export default async function AdminCratePage({ params }: Props) {
  const admin = await getAdminUser();
  if (!admin) redirect('/');

  const { id } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('themed_crates')
    .select('id, user_id, name, prompt, tracks_json, created_at')
    .eq('id', id)
    .single();

  if (!data) notFound();

  // Lookup owner email via auth admin
  const { data: userRes } = await supabase.auth.admin.getUserById(data.user_id);
  const ownerEmail = userRes?.user?.email ?? data.user_id;

  const tracks: CrateTrack[] = Array.isArray(data.tracks_json) ? (data.tracks_json as CrateTrack[]) : [];
  const date = new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ background: S.bg, minHeight: '100vh', color: S.text }}>
      {/* Admin header */}
      <div style={{
        padding: '12px 40px', borderBottom: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: S.surface2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/admin" style={{ fontFamily: S.mono, fontSize: 11, letterSpacing: 2, color: S.textMuted, textDecoration: 'none', textTransform: 'uppercase' }}>
            ← Control Room
          </a>
          <span style={{ color: S.border }}>|</span>
          <span style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted }}>
            {ownerEmail}
          </span>
        </div>
        <span style={{
          fontFamily: S.mono, fontSize: 11, letterSpacing: 1, color: S.textMuted,
          border: `1px solid ${S.border}`, borderRadius: 3, padding: '4px 10px',
        }}>
          CRATE
        </span>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '56px 40px 96px' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: S.mono, fontSize: 12, color: S.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{date}</div>
          <h1 style={{ fontFamily: S.display, fontSize: 'clamp(40px,6vw,80px)', letterSpacing: 4, margin: '0 0 12px', lineHeight: .95, color: S.text }}>
            {data.name.toUpperCase()}
          </h1>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
            <span style={{ fontFamily: S.mono, fontSize: 13, color: S.textSec }}>
              {tracks.length} tracks
            </span>
          </div>
          {data.prompt && (
            <div style={{ marginTop: 16, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '12px 16px' }}>
              <span style={{ fontFamily: S.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: S.textMuted, marginRight: 10 }}>Prompt</span>
              <span style={{ fontFamily: S.mono, fontSize: 13, color: S.textSec }}>{data.prompt}</span>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontFamily: S.mono, fontSize: 12, letterSpacing: 2, color: S.textSec, textTransform: 'uppercase', marginBottom: 12 }}>
            Tracklist
          </div>
          {tracks.length === 0 ? (
            <div style={{ fontFamily: S.mono, fontSize: 13, color: S.textMuted, padding: '24px 0' }}>No tracks saved.</div>
          ) : (
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: S.mono, fontSize: 12 }}>
                <thead style={{ background: S.surface2 }}>
                  <tr>
                    {['#', 'Artist', 'Title', 'BPM', 'Key', 'Genre', 'Year'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: S.textMuted, fontWeight: 400, borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((t, i) => (
                    <tr key={t.id ?? i} style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 0 ? 'transparent' : S.surface }}>
                      <td style={{ padding: '7px 12px', color: S.textMuted, whiteSpace: 'nowrap' }}>{i + 1}</td>
                      <td style={{ padding: '7px 12px', color: S.text, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</td>
                      <td style={{ padding: '7px 12px', color: S.textSec, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</td>
                      <td style={{ padding: '7px 12px', color: S.accent, whiteSpace: 'nowrap' }}>{t.bpm ?? '—'}</td>
                      <td style={{ padding: '7px 12px', color: S.textSec, whiteSpace: 'nowrap' }}>{t.key ?? '—'}</td>
                      <td style={{ padding: '7px 12px', color: S.textMuted, whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.genre ?? '—'}</td>
                      <td style={{ padding: '7px 12px', color: S.textMuted, whiteSpace: 'nowrap' }}>{t.year ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
