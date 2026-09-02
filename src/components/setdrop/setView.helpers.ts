// Server-safe helpers for the shared set view. These are pure functions (no React,
// no client-only APIs) so they can be called from BOTH server components (the admin
// inspector + public share page, which run toDisplayTracks at request time) AND the
// client owner view (SetlistOutput). They must NOT live in SetView.tsx, which is a
// 'use client' module — calling a client-module function from a server component is
// a React boundary violation (runtime 500). The <SetView> component itself stays in
// SetView.tsx; only this data/formatting layer lives here.
import type { SampleTrack } from '@/lib/setdrop/constants';
import type { SetlistTrack } from '@/lib/agents/types';

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

// Drop owner-only personalization paragraphs from a reviewNotes blob, preserving
// the order of what remains. The public share page calls this SERVER-SIDE before
// passing reviewNotes to <SetView> so the owner's gig history never reaches the
// client at all — `showPersonalization={false}` only gates rendering, but the raw
// prop is still serialized into the page's Flight payload, so hiding without
// stripping would leak the text into page source. Keep in sync with the
// personalization prefix in splitReviewNotes.
export function stripPersonalization(notes: string | null | undefined): string | undefined {
  if (!notes) return undefined;
  const kept = notes.split('\n\n').map(s => s.trim()).filter(Boolean)
    .filter(p => !/^Personalized from/i.test(p));
  return kept.length ? kept.join('\n\n') : undefined;
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
