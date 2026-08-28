'use client';

import React from 'react';
import { SD } from '@/lib/setdrop/constants';
import type { SampleTrack } from '@/lib/setdrop/constants';
import type { SetlistTrack } from '@/lib/agents/types';
import { TrackRow, EnergyArcChart } from './shared';

// ─── Resolved store URLs ─────────────────────────────────────────────────────
// The live-resolved (Beatport API + web-search) purchase links + confidence.
// In SetlistOutput these arrive fresh from /api/setlist/resolve-urls; for saved
// sets they're persisted onto each track in tracks_json and read back here so
// admin / public / history render the same links the owner saw.
export interface ResolvedUrls {
  beatportUrl?: string;
  bpmSupremeUrl?: string;
  bpmSupremeFound?: boolean;
  traxsourceUrl?: string;
  traxsourceFound?: boolean;
  djcityUrl?: string;
  djcityFound?: boolean;
}

// A SetlistTrack may carry persisted resolved fields (merged in post-generation).
// They're optional on the type, so read them defensively.
type PersistableTrack = SetlistTrack & Partial<ResolvedUrls>;

function resolvedFromTrack(t: PersistableTrack): ResolvedUrls {
  return {
    beatportUrl: t.beatportUrl,
    bpmSupremeUrl: t.bpmSupremeUrl,
    bpmSupremeFound: t.bpmSupremeFound,
    traxsourceUrl: t.traxsourceUrl,
    traxsourceFound: t.traxsourceFound,
    djcityUrl: t.djcityUrl,
    djcityFound: t.djcityFound,
  };
}

function storeSearchUrls(artist: string, title: string, t: SetlistTrack) {
  const q = encodeURIComponent(`${artist} ${title}`);
  return {
    beatport: `https://www.beatport.com/search/tracks?q=${q}`,
    bpmSupreme: t.bpmSupremeSearchUrl ?? `https://www.bpmsupreme.com/search?q=${q}`,
    traxsource: t.traxsourceSearchUrl ?? `https://www.traxsource.com/search?term=${q}`,
    djcity: t.djcitySearchUrl ?? `https://www.djcity.com/search?q=${q}`,
  };
}

function poolConfidence(found?: boolean): 'green' | 'yellow' | 'red' {
  if (found === undefined) return 'yellow'; // unverified
  return found ? 'yellow' : 'red';          // likely match : not found
}

// Map a raw DB/pipeline SetlistTrack into the display shape TrackRow expects.
// `resolved` overrides the track's own persisted fields (used by the live view
// while the async resolve is still filling in); otherwise we read what's saved.
export function toDisplayTrack(
  t: SetlistTrack,
  idx: number,
  resolved?: ResolvedUrls,
  genre?: string,
): SampleTrack {
  const base = storeSearchUrls(t.artist, t.title, t);
  const r = resolved ?? resolvedFromTrack(t as PersistableTrack);
  return {
    pos: t.position || idx + 1,
    artist: t.artist,
    title: t.title,
    bpm: t.bpm,
    key: t.key,
    energy: t.energyLevel,
    wishlist: t.isWishlistTrack,
    wordplay: t.wordplayConnection ?? null,
    why: t.whyThisTrack,
    transition: t.transitionNotes,
    stores: {
      beatport: r.beatportUrl ? 'green' as const : 'yellow' as const,
      bpmSupreme: poolConfidence(r.bpmSupremeFound),
      traxsource: poolConfidence(r.traxsourceFound),
      djcity: poolConfidence(r.djcityFound),
    },
    storeUrls: {
      ...base,
      beatport: r.beatportUrl ?? base.beatport,
      bpmSupreme: r.bpmSupremeUrl ?? base.bpmSupreme,
      traxsource: r.traxsourceUrl ?? base.traxsource,
      djcity: r.djcityUrl ?? base.djcity,
    },
    genre,
  };
}

// Convenience: map a whole tracklist. `resolvedMap` is keyed by track position.
export function toDisplayTracks(
  tracks: SetlistTrack[],
  resolvedMap?: Record<number, ResolvedUrls>,
  genre?: string,
): SampleTrack[] {
  return tracks.map((t, i) => toDisplayTrack(t, i, resolvedMap?.[t.position || i + 1], genre));
}

// ─── reviewNotes parsing ─────────────────────────────────────────────────────
// `reviewNotes` is a "\n\n"-joined blob: the model's set commentary plus honesty
// notes the pipeline appends (thin-library advisories, personalization). Bucket
// by known prefixes so each renders in the right tone. (Brittle if backend copy
// changes — a structured advisories[] field is the flagged follow-up.)
export function splitReviewNotes(notes: string): { commentary: string[]; advisories: string[]; personalization: string[] } {
  const commentary: string[] = [], advisories: string[] = [], personalization: string[] = [];
  for (const p of notes.split('\n\n').map(s => s.trim()).filter(Boolean)) {
    if (/^(Note:|Heads up)/i.test(p)) advisories.push(p);
    else if (/^Personalized from/i.test(p)) personalization.push(p);
    else commentary.push(p);
  }
  return { commentary, advisories, personalization };
}

// The model writes reviewNotes in markdown; we render into a plain mono/prose UI,
// so strip the syntax (bullets → •, drop **/__/`/#/>). Line breaks are preserved
// via whiteSpace:'pre-wrap' at the render site.
export function formatNoteText(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/__(.+?)__/g, '$1')       // __bold__
    .replace(/`([^`]+)`/g, '$1')       // `code`
    .replace(/^#{1,6}\s+/gm, '')       // # headings
    .replace(/^\s*>\s?/gm, '')         // > blockquote
    .replace(/^\s*[-*+]\s+/gm, '• ');  // - bullets → •
}

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
