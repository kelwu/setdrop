import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import type { SetlistTrack } from '@/lib/agents/types';

const S = {
  bg: '#0A0A0A', surface: '#141414', border: 'rgba(255,255,255,0.07)',
  accent: '#F5A623', accentDim: 'rgba(245,166,35,0.12)',
  text: '#F0F0F0', textSec: '#8A8A8A', textMuted: '#4A4A4A',
  mono: 'var(--font-mono), monospace', display: 'var(--font-display), sans-serif',
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('setlists')
    .select('name, primary_genre, secondary_genre')
    .eq('share_url', slug)
    .eq('is_public', true)
    .single();
  if (!data) return { title: 'SetDrop' };
  const genre = [data.primary_genre, data.secondary_genre].filter(Boolean).join(' / ');
  const desc = genre ? `${genre} setlist, built with SetDrop` : 'Built with SetDrop';
  return {
    title: `${data.name} — SetDrop`,
    description: desc,
    openGraph: { title: `${data.name} — SetDrop`, description: desc, siteName: 'SetDrop' },
  };
}

export default async function PublicSetPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('setlists')
    .select('id, name, primary_genre, secondary_genre, crowd_context, duration_minutes, created_at, tracks_json')
    .eq('share_url', slug)
    .eq('is_public', true)
    .single();

  if (!data) notFound();

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
      <div style={{ padding: '20px 40px', borderBottom: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontFamily: S.display, fontSize: 22, letterSpacing: 3,
          color: S.text, textDecoration: 'none' }}>
          SET<span style={{ color: S.accent }}>DROP</span>
        </a>
        <span style={{ fontFamily: S.mono, fontSize: 10, color: S.textMuted, letterSpacing: 1.5 }}>
          Built with SetDrop
        </span>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '64px 40px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: S.mono, fontSize: 9, color: S.textMuted,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{date}</div>
          <h1 style={{ fontFamily: S.display, fontSize: 'clamp(48px,7vw,96px)',
            letterSpacing: 4, margin: '0 0 12px', lineHeight: .95, color: S.text }}>
            {data.name.toUpperCase()}
          </h1>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
            {[genre, crowd, dur, `${tracks.length} tracks`].filter(Boolean).map((v, i) => (
              <span key={i} style={{ fontFamily: S.mono, fontSize: 11, color: S.textSec }}>
                {i > 0 && <span style={{ color: S.textMuted, marginRight: 16 }}>·</span>}
                {v}
              </span>
            ))}
          </div>
        </div>

        {arcD && (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`,
            borderRadius: 4, padding: '20px 20px 10px', marginBottom: 24, overflow: 'hidden' }}>
            <div style={{ fontFamily: S.mono, fontSize: 9, letterSpacing: 2,
              color: S.textMuted, textTransform: 'uppercase', marginBottom: 14 }}>Energy Arc</div>
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
                      <text x={px - 8} y={y + 4} textAnchor="end" fill={S.textMuted}
                        fontSize={9} fontFamily="var(--font-mono),monospace">{v}</text>
                    </g>
                  );
                })}
                <path d={arcFill} fill="url(#arcFill)" />
                <path d={arcD} fill="none" stroke={S.accent} strokeWidth={2} />
                {pts.map((pt, i) => (
                  <g key={i}>
                    <circle cx={pt[0]} cy={pt[1]} r={4} fill={S.accent} stroke={S.bg} strokeWidth={1.5} />
                    <text x={pt[0]} y={py + ch + 16} textAnchor="middle"
                      fill={S.textMuted} fontSize={8} fontFamily="var(--font-mono),monospace">
                      {tracks[i].artist.split(' ')[0]}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: S.mono, fontSize: 9, letterSpacing: 2,
            color: S.textSec, textTransform: 'uppercase', marginBottom: 12 }}>Tracklist</div>
          {tracks.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16,
              padding: '14px 16px', borderBottom: `1px solid ${S.border}` }}>
              <span style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted,
                width: 22, textAlign: 'right', flexShrink: 0 }}>
                {String(t.position || i + 1).padStart(2, '0')}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: S.mono, fontSize: 13, fontWeight: 600,
                    color: S.text }}>{t.artist}</span>
                  <span style={{ fontFamily: S.mono, fontSize: 12, color: S.textSec }}>— {t.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                  <span style={{ fontFamily: S.mono, fontSize: 10, color: S.accent }}>{t.bpm} BPM</span>
                  <span style={{ fontFamily: S.mono, fontSize: 10, color: S.textSec }}>{t.key}</span>
                  {t.harmonicMixingNotes && (
                    <span style={{ fontFamily: S.mono, fontSize: 10, color: S.textMuted }}>{t.harmonicMixingNotes}</span>
                  )}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <span style={{ fontFamily: S.mono, fontSize: 11, color: S.accentDim,
                  background: S.accentDim, border: `1px solid ${S.accent}22`,
                  borderRadius: 2, padding: '2px 6px' }}>
                  E{t.energyLevel}
                </span>
              </div>
            </div>
          ))}
        </div>

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
            }}>Try SetDrop Free</a>
            <div style={{ marginTop: 14, fontFamily: S.mono, fontSize: 10, color: S.textMuted }}>
              {process.env.NEXT_PUBLIC_APP_URL ?? 'setdrop-phi.vercel.app'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
