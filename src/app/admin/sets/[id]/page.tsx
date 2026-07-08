import { notFound, redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/server';
import type { SetlistTrack } from '@/lib/agents/types';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

const S = {
  bg: '#0A0A0A', surface: '#141414', surface2: '#1A1A1A', border: 'rgba(255,255,255,0.07)',
  accent: '#F5A623', accentDim: 'rgba(245,166,35,0.12)',
  text: '#F0F0F0', textSec: '#8A8A8A', textMuted: '#4A4A4A',
  mono: 'var(--font-mono), monospace', display: 'var(--font-display), sans-serif',
};

type Props = { params: Promise<{ id: string }> };

export default async function AdminSetPage({ params }: Props) {
  const admin = await getAdminUser();
  if (!admin) redirect('/');

  const { id } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('setlists')
    .select('id, user_id, name, primary_genre, secondary_genre, crowd_context, duration_minutes, lineup_slot, vibe, wordplay_theme, is_public, share_url, created_at, tracks_json')
    .eq('id', id)
    .single();

  if (!data) notFound();

  // Lookup owner email via auth admin
  const { data: userRes } = await supabase.auth.admin.getUserById(data.user_id);
  const ownerEmail = userRes?.user?.email ?? data.user_id;

  const tracks: SetlistTrack[] = Array.isArray(data.tracks_json) ? (data.tracks_json as SetlistTrack[]) : [];
  const date = new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const genre = [data.primary_genre, data.secondary_genre].filter(Boolean).join(' / ') || 'Mixed';
  const crowd = data.crowd_context
    ? data.crowd_context.charAt(0).toUpperCase() + data.crowd_context.slice(1).replace('-', ' ')
    : '';
  const dur = data.duration_minutes ? `${data.duration_minutes} min` : '';

  // Energy arc SVG
  const arcW = 760, arcH = 150;
  const px = 44, py = 18;
  const cw = arcW - px * 2, ch = arcH - py * 2;
  const n = tracks.length;
  const pts: [number, number][] = n >= 2
    ? tracks.map((t, i) => [px + (i / (n - 1)) * cw, py + ch - (t.energyLevel / 10) * ch])
    : [];
  const arcD = pts.reduce((a, p, i) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const pr = pts[i - 1], cx = (pr[0] + p[0]) / 2;
    return a + ` C${cx},${pr[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
  }, '');
  const arcFill = arcD ? arcD + ` L${pts[n - 1][0]},${py + ch} L${px},${py + ch}Z` : '';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data.is_public && data.share_url && (
            <a
              href={`/set/${data.share_url}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: S.mono, fontSize: 11, letterSpacing: 1, color: S.accent,
                border: `1px solid rgba(245,166,35,0.3)`, borderRadius: 3,
                padding: '4px 10px', textDecoration: 'none',
              }}
            >
              PUBLIC URL →
            </a>
          )}
          {!data.is_public && (
            <span style={{
              fontFamily: S.mono, fontSize: 11, letterSpacing: 1, color: S.textMuted,
              border: `1px solid ${S.border}`, borderRadius: 3, padding: '4px 10px',
            }}>
              PRIVATE SET
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '56px 40px 96px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: S.mono, fontSize: 12, color: S.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{date}</div>
          <h1 style={{ fontFamily: S.display, fontSize: 'clamp(40px,6vw,80px)', letterSpacing: 4, margin: '0 0 12px', lineHeight: .95, color: S.text }}>
            {data.name.toUpperCase()}
          </h1>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
            {[genre, crowd, dur, data.lineup_slot, `${tracks.length} tracks`].filter(Boolean).map((v, i) => (
              <span key={i} style={{ fontFamily: S.mono, fontSize: 13, color: S.textSec }}>
                {i > 0 && <span style={{ color: S.textMuted, marginRight: 16 }}>·</span>}
                {v}
              </span>
            ))}
          </div>
          {(data.vibe || data.wordplay_theme) && (
            <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {data.vibe && <span style={{ fontFamily: S.mono, fontSize: 12, color: S.textMuted }}>Vibe: {data.vibe}</span>}
              {data.wordplay_theme && <span style={{ fontFamily: S.mono, fontSize: 12, color: S.textMuted }}>Wordplay: {data.wordplay_theme}</span>}
            </div>
          )}
        </div>

        {arcD && (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '20px 20px 10px', marginBottom: 24, overflow: 'hidden' }}>
            <div style={{ fontFamily: S.mono, fontSize: 12, letterSpacing: 2, color: S.textMuted, textTransform: 'uppercase', marginBottom: 14 }}>Energy Arc</div>
            <div style={{ overflowX: 'auto' }}>
              <svg width={arcW} height={arcH} style={{ overflow: 'visible', display: 'block' }}>
                <defs>
                  <linearGradient id="arcFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={S.accent} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={S.accent} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                {[0, 2, 4, 6, 8, 10].map(v => {
                  const y = py + ch - (v / 10) * ch;
                  return (
                    <g key={v}>
                      <line x1={px} y1={y} x2={px + cw} y2={y} stroke={S.border} strokeWidth={0.5} />
                      <text x={px - 8} y={y + 4} textAnchor="end" fill={S.textMuted} fontSize={9} fontFamily="var(--font-mono),monospace">{v}</text>
                    </g>
                  );
                })}
                <path d={arcFill} fill="url(#arcFill)" />
                <path d={arcD} fill="none" stroke={S.accent} strokeWidth={2} />
                {pts.map((pt, i) => (
                  <g key={i}>
                    <circle cx={pt[0]} cy={pt[1]} r={4} fill={S.accent} stroke={S.bg} strokeWidth={1.5} />
                    <text x={pt[0]} y={py + ch + 16} textAnchor="middle" fill={S.textMuted} fontSize={8} fontFamily="var(--font-mono),monospace">
                      {tracks[i].artist?.split(' ')[0] ?? ''}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        )}

        <div>
          <div style={{ fontFamily: S.mono, fontSize: 12, letterSpacing: 2, color: S.textSec, textTransform: 'uppercase', marginBottom: 12 }}>
            Tracklist
          </div>
          {tracks.length === 0 && (
            <div style={{ fontFamily: S.mono, fontSize: 13, color: S.textMuted, padding: '24px 0' }}>No tracks saved.</div>
          )}
          {tracks.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', borderBottom: `1px solid ${S.border}` }}>
              <span style={{ fontFamily: S.mono, fontSize: 13, color: S.textMuted, width: 22, textAlign: 'right', flexShrink: 0 }}>
                {String(t.position || i + 1).padStart(2, '0')}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: S.mono, fontSize: 13, fontWeight: 600, color: S.text }}>{t.artist}</span>
                  <span style={{ fontFamily: S.mono, fontSize: 12, color: S.textSec }}>— {t.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                  <span style={{ fontFamily: S.mono, fontSize: 12, color: S.accent }}>{t.bpm} BPM</span>
                  <span style={{ fontFamily: S.mono, fontSize: 12, color: S.textSec }}>{t.key}</span>
                  {t.harmonicMixingNotes && (
                    <span style={{ fontFamily: S.mono, fontSize: 12, color: S.textSec }}>{t.harmonicMixingNotes}</span>
                  )}
                </div>
                {t.whyThisTrack && (
                  <div style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted, marginTop: 4, lineHeight: 1.5 }}>{t.whyThisTrack}</div>
                )}
              </div>
              <div style={{ flexShrink: 0 }}>
                <span style={{ fontFamily: S.mono, fontSize: 13, color: S.accentDim, background: S.accentDim, border: `1px solid ${S.accent}22`, borderRadius: 2, padding: '2px 6px' }}>
                  E{t.energyLevel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
