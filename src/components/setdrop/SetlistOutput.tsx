'use client';

import React, { useState } from 'react';
import { SD, SAMPLE_TRACKS } from '@/lib/setdrop/constants';
import { GeneratedSetlist, SetlistTrack, LibraryTrack } from '@/lib/agents/types';
import { buildCrate, downloadCrate } from '@/lib/setdrop/serato-crate';
import { createClient } from '@/lib/supabase/client';
import { SDButton, TrackRow, EnergyArcChart } from './shared';

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchFilePaths(tracks: SetlistTrack[], library: LibraryTrack[]): { paths: string[]; matched: number } {
  const paths: string[] = [];
  for (const t of tracks) {
    const na = normalize(t.artist);
    const nt = normalize(t.title);
    const found = library.find(l => normalize(l.artist) === na && normalize(l.title) === nt);
    if (found?.filePath) paths.push(found.filePath);
  }
  return { paths, matched: paths.length };
}

function toDisplayTrack(t: SetlistTrack, idx: number) {
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
      beatport: 'green' as const,
      bpmSupreme: 'yellow' as const,
      traxsource: 'yellow' as const,
      spotify: 'green' as const,
    },
  };
}

export function SetlistOutput({ setPage, setlist }: { setPage: (p: string) => void; setlist: GeneratedSetlist | null }) {
  const [copied, setCopied] = useState(false);
  const [showRegen, setShowRegen] = useState(false);
  const [regenNote, setRegenNote] = useState('');
  const [crateStatus, setCrateStatus] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [making, setMaking] = useState(false);

  const shareUrl = setlist?.dbSlug && typeof window !== 'undefined'
    ? `${window.location.origin}/set/${setlist.dbSlug}`
    : null;

  const handleMakePublic = async () => {
    if (!setlist?.dbId || !shareUrl) return;
    setMaking(true);
    try {
      const supabase = createClient();
      await supabase.from('setlists').update({ is_public: true }).eq('id', setlist.dbId);
      setIsPublic(true);
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } finally {
      setMaking(false);
    }
  };

  const handleExportCrate = () => {
    if (!setlist) return;

    let library: LibraryTrack[] = [];
    try {
      const raw = localStorage.getItem('sd_library');
      if (raw) library = JSON.parse(raw);
    } catch { /* ignore */ }

    if (!library.length) {
      setCrateStatus('Upload your Serato library first so we can match file paths.');
      return;
    }

    const { paths, matched } = matchFilePaths(setlist.tracks, library);

    if (!paths.length) {
      setCrateStatus('No tracks matched your library. Re-upload your Serato CSV to include file paths.');
      return;
    }

    const data = buildCrate(paths);
    downloadCrate(data, setlist.name);
    setCrateStatus(`Downloaded ${matched}/${setlist.tracks.length} tracks — copy the .crate file into your Serato Subcrates folder.`);
    setTimeout(() => setCrateStatus(null), 8000);
  };

  const displayTracks = setlist
    ? setlist.tracks.map((t, i) => toDisplayTrack(t, i))
    : SAMPLE_TRACKS;
  const setlistName = setlist?.name ?? 'Friday Night Affair';

  const avgBpm = Math.round(displayTracks.reduce((a, t) => a + t.bpm, 0) / displayTracks.length);
  const keys = [...new Set(displayTracks.map(t => t.key))];
  const wishCount = displayTracks.filter(t => t.wishlist).length;

  function StatBox({ value, label }: { value: string | number; label: string }) {
    return (
      <div style={{ textAlign:'center', padding:'20px 16px',
        background:SD.bg, border:`1px solid ${SD.border}`, borderRadius:3 }}>
        <div style={{ fontFamily:SD.display, fontSize:40, letterSpacing:2,
          color:SD.accent, lineHeight:1 }}>{value}</div>
        <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
          letterSpacing:1.5, textTransform:'uppercase', marginTop:6 }}>{label}</div>
      </div>
    );
  }

  return (
    <div style={{ background:SD.bg, minHeight:'100vh', paddingTop:56, color:SD.text }}>
      <div className="sd-pad-x sd-inner-pad" style={{ maxWidth:1280, margin:'0 auto', padding:'48px 40px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          gap:24, flexWrap:'wrap', marginBottom:40 }}>
          <div>
            <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
              letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Generated Set</div>
            <h1 style={{ fontFamily:SD.display, fontSize:52, letterSpacing:4,
              margin:'0 0 8px', color:SD.text, lineHeight:1 }}>{setlistName.toUpperCase()}</h1>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              {['Afrobeats / Hip Hop','Club','90 min','Headliner','Apr 22 2026'].map((v, i) => (
                <span key={i} style={{ fontFamily:SD.mono, fontSize:11, color:SD.textSec }}>
                  {i > 0 && <span style={{ color:SD.textMuted, marginRight:16 }}>·</span>}
                  {v}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-start' }}>
            <SDButton ghost onClick={() => setShowRegen(!showRegen)} style={{ fontSize:10, padding:'8px 16px' }}>
              Regenerate
            </SDButton>
            <SDButton ghost onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              style={{ fontSize:10, padding:'8px 16px' }}>
              {copied ? '✓ Copied' : 'Copy List'}
            </SDButton>
            <SDButton ghost onClick={() => setPage('share')} style={{ fontSize:10, padding:'8px 16px' }}>
              Share ↗
            </SDButton>
            <SDButton style={{ fontSize:11, padding:'10px 24px' }} onClick={handleExportCrate}>
              Export Serato Crate
            </SDButton>
          </div>
        </div>

        {crateStatus && (
          <div style={{
            marginBottom: 20, padding: '12px 16px',
            background: crateStatus.startsWith('Downloaded') ? SD.greenDim : SD.accentDim,
            border: `1px solid ${crateStatus.startsWith('Downloaded') ? SD.green + '44' : SD.accent + '44'}`,
            borderRadius: 3, fontFamily: SD.mono, fontSize: 11,
            color: crateStatus.startsWith('Downloaded') ? SD.green : SD.accent,
          }}>
            {crateStatus}
          </div>
        )}

        {showRegen && (
          <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
            borderRadius:4, padding:'20px 24px', marginBottom:24,
            display:'flex', gap:12, alignItems:'center' }}>
            <input
              value={regenNote} onChange={e => setRegenNote(e.target.value)}
              placeholder={`e.g. "Make it darker", "More Afrobeats", "Slow down the peak"`}
              style={{ flex:1, background:SD.bg, border:`1px solid ${SD.border}`,
                borderRadius:3, padding:'10px 14px', color:SD.text,
                fontFamily:SD.mono, fontSize:12, outline:'none' }}
              onFocus={e => (e.target.style.borderColor = SD.accent)}
              onBlur={e => (e.target.style.borderColor = SD.border)}
            />
            <SDButton onClick={() => { setShowRegen(false); setPage('builder'); }}>Rebuild</SDButton>
          </div>
        )}

        {/* Two-column layout */}
        <div className="sd-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:16, alignItems:'start' }}>

          {/* Tracklist */}
          <div>
            <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textSec,
              letterSpacing:2, textTransform:'uppercase', marginBottom:12,
              display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>Tracklist — {displayTracks.length} tracks</span>
              {wishCount > 0 && (
                <span style={{ color:SD.accent, display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:SD.accent, display:'inline-block' }}/>
                  {wishCount} need downloading
                </span>
              )}
            </div>
            {displayTracks.map(t => <TrackRow key={t.pos} track={t} />)}
          </div>

          {/* Sidebar */}
          <div style={{ display:'flex', flexDirection:'column', gap:12, position:'sticky', top:72 }}>
            <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
              borderRadius:4, padding:'20px 16px 10px', overflow:'hidden' }}>
              <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:2,
                color:SD.textMuted, textTransform:'uppercase', marginBottom:14 }}>Energy Arc</div>
              <div style={{ overflowX:'auto' }}>
                <EnergyArcChart tracks={displayTracks} width={348} height={170} />
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <StatBox value={avgBpm} label="Avg BPM" />
              <StatBox value={displayTracks.length} label="Tracks" />
              <StatBox value={keys.length} label="Keys used" />
              <StatBox value="90m" label="Duration" />
            </div>

            <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
              borderRadius:4, padding:'18px 20px' }}>
              <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:2,
                color:SD.textMuted, textTransform:'uppercase', marginBottom:14 }}>Key Distribution</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {displayTracks.map(t => (
                  <span key={t.pos} style={{ fontFamily:SD.mono, fontSize:10, color:SD.accent,
                    background:SD.accentDim, border:`1px solid ${SD.accent}33`,
                    borderRadius:2, padding:'3px 8px' }}>{t.key}</span>
                ))}
              </div>
            </div>

            <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
              borderRadius:4, padding:'18px 20px' }}>
              <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:2,
                color:SD.textMuted, textTransform:'uppercase', marginBottom:14 }}>Genre Mix</div>
              {([['Afrobeats','45%'],['Hip Hop','30%'],['R&B','15%'],['Latin','10%']] as [string,string][]).map(([g, p]) => (
                <div key={g} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec }}>{g}</span>
                    <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.accent }}>{p}</span>
                  </div>
                  <div style={{ height:2, background:SD.surface3, borderRadius:1 }}>
                    <div style={{ height:'100%', width:p, background:SD.accent, borderRadius:1 }}/>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
              borderRadius:4, padding:'18px 20px' }}>
              <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:2,
                color:SD.textMuted, textTransform:'uppercase', marginBottom:12 }}>Share</div>
              {shareUrl ? (
                <>
                  <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.accent,
                    background:SD.accentDim, border:`1px solid ${SD.accent}33`,
                    borderRadius:3, padding:'10px 12px', wordBreak:'break-all' }}>
                    {shareUrl.replace(/^https?:\/\//, '')}
                  </div>
                  <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8 }}>
                    {isPublic ? (
                      <SDButton ghost full
                        onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        style={{ fontSize:10 }}>
                        {copied ? '✓ Link Copied' : 'Copy Link'}
                      </SDButton>
                    ) : (
                      <SDButton ghost full onClick={handleMakePublic}
                        style={{ fontSize:10, opacity: making ? 0.6 : 1 }}>
                        {making ? 'Publishing...' : 'Make Public + Copy Link'}
                      </SDButton>
                    )}
                    <SDButton ghost full onClick={() => setPage('share')} style={{ fontSize:10 }}>
                      Preview ↗
                    </SDButton>
                  </div>
                </>
              ) : (
                <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted }}>
                  Generate a setlist to get a share link
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
