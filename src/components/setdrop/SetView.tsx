'use client';

import React from 'react';
import { SD } from '@/lib/setdrop/constants';
import type { SampleTrack } from '@/lib/setdrop/constants';
import { TrackRow, EnergyArcChart } from './shared';
import { splitReviewNotes, formatNoteText } from './setView.helpers';

// Re-export the data/formatting helpers so existing client imports of
// `from './SetView'` keep working. Server components MUST import these from
// './setView.helpers' directly (this module is 'use client').
export { toDisplayTrack, toDisplayTracks, splitReviewNotes, formatNoteText } from './setView.helpers';
export type { ResolvedUrls } from './setView.helpers';

function StatBox({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ textAlign:'center', padding:'20px 16px',
      background:SD.bg, border:`1px solid ${SD.border}`, borderRadius:3 }}>
      <div style={{ fontFamily:SD.display, fontSize:40, letterSpacing:2,
        color:SD.accent, lineHeight:1 }}>{value}</div>
      <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textMuted,
        letterSpacing:1.5, textTransform:'uppercase', marginTop:6 }}>{label}</div>
    </div>
  );
}

// ─── HeadsUp (thin-library advisory) ─────────────────────────────────────────
// Rendered ABOVE the tracklist by every view — short and actionable.
export function SetHeadsUp({ reviewNotes }: { reviewNotes?: string }) {
  const notes = reviewNotes?.trim();
  if (!notes) return null;
  const { advisories } = splitReviewNotes(notes);
  if (!advisories.length) return null;
  return (
    <div style={{ background:SD.warningDim, border:`1px solid ${SD.warning}44`,
      borderRadius:4, padding:'14px 16px', marginBottom:24 }}>
      <div style={{ fontFamily:SD.mono, fontSize:11, letterSpacing:2, textTransform:'uppercase', color:SD.warning, marginBottom:8 }}>Heads Up</div>
      {advisories.map((line, i) => (
        <p key={i} style={{ fontFamily:SD.mono, fontSize:13, lineHeight:1.65, color:SD.text, whiteSpace:'pre-wrap', margin: i ? '8px 0 0' : 0 }}>{formatNoteText(line)}</p>
      ))}
    </div>
  );
}

// ─── SetView (shared read-only body) ─────────────────────────────────────────
// The single source of truth for how a saved set's BODY renders — tracklist +
// energy arc + stat sidebar + key distribution + Set Info + Set Notes. Used by
// SetlistOutput (owner, live), the admin inspector, and the public share page so
// all three stay visually identical. Headers and interactive chrome stay with
// each caller; owner-only extras (Share, Gig Log) come in via `sidebarExtra`.
interface SetViewProps {
  tracks: SampleTrack[];
  reviewNotes?: string;
  durationLabel?: string;
  setInfo?: [string, string][];
  // Personalized notes expose the owner's gig history — keep them out of the
  // public share page (default true = show, for owner/admin).
  showPersonalization?: boolean;
  // Owner-only cards (Share, Gig Log) appended to the sidebar column.
  sidebarExtra?: React.ReactNode;
  // Live "Resolving links" spinner in the tracklist header (owner view only).
  resolving?: boolean;
  // Wishlist "N need downloading" counter in the tracklist header.
  showWishlistCount?: boolean;
}

export function SetView({
  tracks,
  reviewNotes,
  durationLabel,
  setInfo,
  showPersonalization = true,
  sidebarExtra,
  resolving = false,
  showWishlistCount = true,
}: SetViewProps) {
  const avgBpm = tracks.length ? Math.round(tracks.reduce((a, t) => a + t.bpm, 0) / tracks.length) : 0;
  const keys = [...new Set(tracks.map(t => t.key))];
  const wishCount = tracks.filter(t => t.wishlist).length;

  return (
    <>
      <SetHeadsUp reviewNotes={reviewNotes} />

      {/* Two-column layout — the standard across all three views */}
      <div className="sd-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:16, alignItems:'start' }}>

        {/* Tracklist */}
        <div>
          <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textSec,
            letterSpacing:2, textTransform:'uppercase', marginBottom:12,
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Tracklist — {tracks.length} tracks</span>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              {resolving && (
                <span style={{ color:SD.textMuted, display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ display:'inline-block', animation:'sdSpin 1s linear infinite' }}>↻</span>
                  Resolving links
                </span>
              )}
              {showWishlistCount && wishCount > 0 && (
                <span style={{ color:SD.accent, display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:SD.accent, display:'inline-block' }}/>
                  {wishCount} need downloading
                </span>
              )}
            </div>
          </div>
          {tracks.length === 0 && (
            <div style={{ fontFamily:SD.mono, fontSize:13, color:SD.textMuted, padding:'24px 0' }}>No tracks saved.</div>
          )}
          {tracks.map(t => <TrackRow key={t.pos} track={t} />)}
        </div>

        {/* Sidebar */}
        <div className="sd-sticky-on-desktop" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {tracks.length >= 2 && (
            <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
              borderRadius:4, padding:'20px 16px 10px', overflow:'hidden' }}>
              <div style={{ fontFamily:SD.mono, fontSize:12, letterSpacing:2,
                color:SD.textMuted, textTransform:'uppercase', marginBottom:14 }}>Energy Arc</div>
              <div style={{ overflowX:'auto' }}>
                <EnergyArcChart tracks={tracks} width={348} height={170} />
              </div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <StatBox value={avgBpm} label="Avg BPM" />
            <StatBox value={tracks.length} label="Tracks" />
            <StatBox value={keys.length} label="Keys used" />
            {durationLabel && <StatBox value={durationLabel} label="Duration" />}
          </div>

          <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
            borderRadius:4, padding:'18px 20px' }}>
            <div style={{ fontFamily:SD.mono, fontSize:12, letterSpacing:2,
              color:SD.textMuted, textTransform:'uppercase', marginBottom:14 }}>Key Distribution</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {tracks.map(t => (
                <span key={t.pos} style={{ fontFamily:SD.mono, fontSize:12, color:SD.accent,
                  background:SD.accentDim, border:`1px solid ${SD.accent}33`,
                  borderRadius:2, padding:'3px 8px' }}>{t.key}</span>
              ))}
            </div>
          </div>

          {setInfo && setInfo.length > 0 && (
            <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
              borderRadius:4, padding:'18px 20px' }}>
              <div style={{ fontFamily:SD.mono, fontSize:12, letterSpacing:2,
                color:SD.textMuted, textTransform:'uppercase', marginBottom:14 }}>Set Info</div>
              {setInfo.map(([label, value]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between',
                  marginBottom:10, alignItems:'baseline' }}>
                  <span style={{ fontFamily:SD.mono, fontSize:12, color:SD.textMuted,
                    letterSpacing:1, textTransform:'uppercase' }}>{label}</span>
                  <span style={{ fontFamily:SD.mono, fontSize:13, color:SD.textSec }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {sidebarExtra}
        </div>
      </div>

      {/* Set notes — model overview + (optionally) personalization, below the
          tracklist so tracks come first. Markdown-stripped for the mono/prose UI. */}
      {(() => {
        const notes = reviewNotes?.trim();
        if (!notes) return null;
        const { commentary, personalization } = splitReviewNotes(notes);
        const groups = [
          showPersonalization && personalization.length && { key:'pers', eyebrow:'Personalized', fg:SD.info, lines:personalization },
          commentary.length && { key:'note', eyebrow:'Set Notes', fg:SD.textMuted, lines:commentary },
        ].filter(Boolean) as { key:string; eyebrow:string; fg:string; lines:string[] }[];
        if (!groups.length) return null;
        return (
          <div style={{ marginTop:24, display:'flex', flexDirection:'column', gap:16 }}>
            {groups.map(g => (
              <div key={g.key} style={{ background:SD.surface, border:`1px solid ${SD.border}`, borderRadius:4, padding:'16px 18px' }}>
                <div style={{ fontFamily:SD.mono, fontSize:11, letterSpacing:2, textTransform:'uppercase', color:g.fg, marginBottom:10 }}>{g.eyebrow}</div>
                {g.lines.map((line, i) => (
                  <p key={i} style={{ fontFamily:SD.body, fontSize:14, lineHeight:1.7, color:SD.textSec, whiteSpace:'pre-wrap', margin: i ? '10px 0 0' : 0 }}>{formatNoteText(line)}</p>
                ))}
              </div>
            ))}
          </div>
        );
      })()}
    </>
  );
}
