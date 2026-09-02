import { notFound, redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/server';
import type { SetlistTrack } from '@/lib/agents/types';
import { SD } from '@/lib/setdrop/constants';
import { SetView } from '@/components/setdrop/SetView';
import { toDisplayTracks } from '@/components/setdrop/setView.helpers';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function AdminSetPage({ params }: Props) {
  const admin = await getAdminUser();
  if (!admin) redirect('/');

  const { id } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('setlists')
    .select('id, user_id, name, primary_genre, secondary_genre, crowd_context, duration_minutes, lineup_slot, vibe, wordplay_theme, is_public, share_url, created_at, tracks_json, review_notes')
    .eq('id', id)
    .single();

  if (!data) notFound();

  // Lookup owner email via auth admin
  const { data: userRes } = await supabase.auth.admin.getUserById(data.user_id);
  const ownerEmail = userRes?.user?.email ?? data.user_id;

  // Load user's library for context
  const { data: library } = await supabase
    .from('serato_libraries')
    .select('id, total_tracks, source, last_synced')
    .eq('user_id', data.user_id)
    .single();

  const { data: libraryTracks } = library
    ? await supabase
        .from('serato_tracks')
        .select('artist, title, bpm, key, genre, file_path')
        .eq('library_id', library.id)
        .order('artist', { ascending: true })
        .limit(2000)
    : { data: null };

  // Genre breakdown
  const genreCounts: Record<string, number> = {};
  for (const t of (libraryTracks ?? [])) {
    const g = t.genre ?? 'Unknown';
    genreCounts[g] = (genreCounts[g] ?? 0) + 1;
  }
  const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

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
    <div style={{ background: SD.bg, minHeight: '100vh', color: SD.text }}>
      {/* Admin header */}
      <div style={{
        padding: '12px 40px', borderBottom: `1px solid ${SD.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: SD.surface2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/admin" style={{ fontFamily: SD.mono, fontSize: 11, letterSpacing: 2, color: SD.textMuted, textDecoration: 'none', textTransform: 'uppercase' }}>
            ← Control Room
          </a>
          <span style={{ color: SD.border }}>|</span>
          <span style={{ fontFamily: SD.mono, fontSize: 11, color: SD.textMuted }}>
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
                fontFamily: SD.mono, fontSize: 11, letterSpacing: 1, color: SD.accent,
                border: `1px solid rgba(245,166,35,0.3)`, borderRadius: 3,
                padding: '4px 10px', textDecoration: 'none',
              }}
            >
              PUBLIC URL →
            </a>
          )}
          {!data.is_public && (
            <span style={{
              fontFamily: SD.mono, fontSize: 11, letterSpacing: 1, color: SD.textMuted,
              border: `1px solid ${SD.border}`, borderRadius: 3, padding: '4px 10px',
            }}>
              PRIVATE SET
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '56px 40px 96px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{date}</div>
          <h1 style={{ fontFamily: SD.display, fontSize: 'clamp(40px,6vw,80px)', letterSpacing: 4, margin: '0 0 12px', lineHeight: .95, color: SD.text }}>
            {data.name.toUpperCase()}
          </h1>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
            {[genre, crowd, dur, data.lineup_slot, `${tracks.length} tracks`].filter(Boolean).map((v, i) => (
              <span key={i} style={{ fontFamily: SD.mono, fontSize: 13, color: SD.textSec }}>
                {i > 0 && <span style={{ color: SD.textMuted, marginRight: 16 }}>·</span>}
                {v}
              </span>
            ))}
          </div>
          {(data.vibe || data.wordplay_theme) && (
            <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {data.vibe && <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted }}>Vibe: {data.vibe}</span>}
              {data.wordplay_theme && <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted }}>Wordplay: {data.wordplay_theme}</span>}
            </div>
          )}
        </div>

        {/* User Library */}
        <div style={{ marginBottom: 48, border: `1px solid ${SD.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', background: SD.surface2, borderBottom: `1px solid ${SD.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: SD.mono, fontSize: 12, letterSpacing: 2, color: SD.textSec, textTransform: 'uppercase' }}>
              User Library
            </div>
            {library ? (
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted }}>
                  {(libraryTracks?.length ?? 0).toLocaleString()} tracks{(libraryTracks?.length ?? 0) >= 2000 ? ' (capped at 2000)' : ''}
                </span>
                <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted }}>
                  {library.source ?? 'serato'}
                </span>
                <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted }}>
                  synced {new Date(library.last_synced).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ) : (
              <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted }}>No library uploaded</span>
            )}
          </div>
          {topGenres.length > 0 && (
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${SD.border}`, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {topGenres.map(([genre, count]) => (
                <span key={genre} style={{ fontFamily: SD.mono, fontSize: 11, color: SD.textMuted, background: SD.surface2, border: `1px solid ${SD.border}`, borderRadius: 2, padding: '2px 8px' }}>
                  {genre} <span style={{ color: SD.textSec }}>{count}</span>
                </span>
              ))}
            </div>
          )}
          {libraryTracks && libraryTracks.length > 0 ? (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SD.mono, fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: SD.surface2, zIndex: 1 }}>
                  <tr>
                    {['Artist', 'Title', 'BPM', 'Key', 'Genre'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: SD.textMuted, fontWeight: 400, borderBottom: `1px solid ${SD.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {libraryTracks.map((t, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${SD.border}` }}>
                      <td style={{ padding: '7px 12px', color: SD.text, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</td>
                      <td style={{ padding: '7px 12px', color: SD.textSec, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</td>
                      <td style={{ padding: '7px 12px', color: SD.accent, whiteSpace: 'nowrap' }}>{t.bpm ?? '—'}</td>
                      <td style={{ padding: '7px 12px', color: SD.textSec, whiteSpace: 'nowrap' }}>{t.key ?? '—'}</td>
                      <td style={{ padding: '7px 12px', color: SD.textMuted, whiteSpace: 'nowrap' }}>{t.genre ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : library ? (
            <div style={{ padding: '20px', fontFamily: SD.mono, fontSize: 12, color: SD.textMuted }}>Library exists but no tracks found.</div>
          ) : null}
        </div>

        <SetView
          tracks={displayTracks}
          reviewNotes={data.review_notes ?? undefined}
          durationLabel={dur || undefined}
          setInfo={setInfo}
        />
      </div>
    </div>
  );
}
