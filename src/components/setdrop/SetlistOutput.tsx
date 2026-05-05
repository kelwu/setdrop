'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SD, SAMPLE_TRACKS } from '@/lib/setdrop/constants';
import { GeneratedSetlist, SetlistTrack, LibraryTrack } from '@/lib/agents/types';
import { buildCrate, downloadCrate } from '@/lib/setdrop/serato-crate';
import { buildRekordboxXml, downloadRekordboxXml } from '@/lib/setdrop/rekordbox-export';
import { createClient } from '@/lib/supabase/client';
import { SDButton, TrackRow, EnergyArcChart } from './shared';

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findLibraryTrack(artist: string, title: string, library: LibraryTrack[]): LibraryTrack | undefined {
  const na = normalize(artist);
  const nt = normalize(title);
  const exact = library.find(l => normalize(l.artist) === na && normalize(l.title) === nt);
  if (exact) return exact;
  return library.find(l => {
    const la = normalize(l.artist);
    const lt = normalize(l.title);
    const artistMatch = la === na || la.startsWith(na) || na.startsWith(la);
    const titleMatch = lt === nt || lt.startsWith(nt) || nt.startsWith(lt);
    return artistMatch && titleMatch;
  });
}

function matchFilePaths(tracks: SetlistTrack[], library: LibraryTrack[]): { paths: string[]; matched: number } {
  const paths: string[] = [];
  for (const t of tracks) {
    const found = findLibraryTrack(t.artist, t.title, library);
    if (found?.filePath) paths.push(found.filePath);
  }
  return { paths, matched: paths.length };
}

function storeSearchUrls(artist: string, title: string, t: SetlistTrack) {
  const q = encodeURIComponent(`${artist} ${title}`);
  return {
    beatport: `https://www.beatport.com/search/tracks?q=${q}`,
    bpmSupreme: t.bpmSupremeSearchUrl ?? `https://www.bpmsupreme.com/search?q=${q}`,
    traxsource: t.traxsourceSearchUrl ?? `https://www.traxsource.com/search?term=${q}`,
  };
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
    storeUrls: storeSearchUrls(t.artist, t.title, t),
  };
}

export function SetlistOutput() {
  const router = useRouter();
  const [setlist, setSetlist] = useState<GeneratedSetlist | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('sd_current_setlist');
      if (raw) setSetlist(JSON.parse(raw));
    } catch { /* ignore corrupted data */ }
  }, []);
  const [showRegen, setShowRegen] = useState(false);
  const [regenNote, setRegenNote] = useState('');
  const [crateStatus, setCrateStatus] = useState<string | null>(null);
  const [libraryOnly, setLibraryOnly] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [making, setMaking] = useState(false);
  const [showGigForm, setShowGigForm] = useState(false);
  const [gigVenue, setGigVenue] = useState('');
  const [gigDate, setGigDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loggingGig, setLoggingGig] = useState(false);
  const [gigLogged, setGigLogged] = useState(false);

  const handleLogGig = async () => {
    if (!setlist?.dbId) return;
    setLoggingGig(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await supabase.from('gig_history').insert({
        user_id: user.id,
        setlist_id: setlist.dbId,
        gig_name: setlist.name,
        gig_date: gigDate,
        venue: gigVenue.trim() || null,
      });
      setGigLogged(true);
      setShowGigForm(false);
    } finally {
      setLoggingGig(false);
    }
  };

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

  const getLibrary = (): LibraryTrack[] => {
    try {
      const raw = localStorage.getItem('sd_library');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const handleExportCrate = async () => {
    if (!setlist) return;
    let library = getLibrary();

    // If localStorage is empty or stale (no file paths), fetch fresh from Supabase
    if (!library.length || !library.some(t => t.filePath)) {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: lib } = await supabase.from('serato_libraries').select('id').eq('user_id', user.id).single();
          if (lib) {
            const PAGE = 1000;
            let offset = 0;
            const allRows: LibraryTrack[] = [];
            while (true) {
              const { data: page } = await supabase
                .from('serato_tracks')
                .select('id, artist, title, bpm, key, genre, file_path')
                .eq('library_id', lib.id)
                .order('artist')
                .range(offset, offset + PAGE - 1);
              if (!page?.length) break;
              allRows.push(...page.map(t => ({
                id: t.id, artist: t.artist ?? '', title: t.title ?? '',
                bpm: t.bpm ?? 0, key: t.key ?? '', genre: t.genre ?? undefined,
                filePath: t.file_path ?? undefined, isWishlist: false,
              })));
              if (page.length < PAGE) break;
              offset += PAGE;
            }
            if (allRows.length) {
              library = allRows;
              localStorage.setItem('sd_library', JSON.stringify(library));
            }
          }
        }
      } catch { /* fall through with what we have */ }
    }

    if (!library.length) { setCrateStatus('Upload your Serato library first so we can match file paths.'); return; }
    const tracks = libraryOnly ? setlist.tracks.filter(t => !t.isWishlistTrack) : setlist.tracks;
    const { paths, matched } = matchFilePaths(tracks, library);
    if (!paths.length) {
      const anyFound = tracks.some(t => library.find(l =>
        l.artist.toLowerCase() === t.artist.toLowerCase() && l.title.toLowerCase() === t.title.toLowerCase()
      ));
      setCrateStatus(anyFound
        ? 'Tracks found but no file paths — re-upload your Serato DB V2 file to restore export.'
        : 'No tracks matched. Re-upload your Serato DB V2 file.');
      return;
    }
    const data = buildCrate(paths);
    downloadCrate(data, setlist.name);
    setCrateStatus(`Downloaded ${matched}/${tracks.length} tracks — copy the .crate file into your Serato Subcrates folder.`);
    setTimeout(() => setCrateStatus(null), 8000);
  };

  const handleExportRekordbox = async () => {
    if (!setlist) return;
    let library = getLibrary();

    // If localStorage is empty or stale, fetch fresh from Supabase
    if (!library.length || !library.some(t => t.filePath)) {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: lib } = await supabase.from('serato_libraries').select('id').eq('user_id', user.id).single();
          if (lib) {
            const PAGE = 1000;
            let offset = 0;
            const allRows: LibraryTrack[] = [];
            while (true) {
              const { data: page } = await supabase
                .from('serato_tracks')
                .select('id, artist, title, bpm, key, genre, file_path')
                .eq('library_id', lib.id)
                .order('artist')
                .range(offset, offset + PAGE - 1);
              if (!page?.length) break;
              allRows.push(...page.map(t => ({
                id: t.id, artist: t.artist ?? '', title: t.title ?? '',
                bpm: t.bpm ?? 0, key: t.key ?? '', genre: t.genre ?? undefined,
                filePath: t.file_path ?? undefined, isWishlist: false,
              })));
              if (page.length < PAGE) break;
              offset += PAGE;
            }
            if (allRows.length) {
              library = allRows;
              localStorage.setItem('sd_library', JSON.stringify(library));
            }
          }
        }
      } catch { /* fall through with what we have */ }
    }

    if (!library.length) { setCrateStatus('Upload your Rekordbox library first so we can match file paths.'); return; }
    const tracks = libraryOnly ? setlist.tracks.filter(t => !t.isWishlistTrack) : setlist.tracks;
    const { xml, matched } = buildRekordboxXml(setlist.name, tracks, library);
    if (!matched) { setCrateStatus('No tracks matched. Re-upload your Rekordbox XML file in the Library tab.'); return; }
    downloadRekordboxXml(xml, setlist.name);
    setCrateStatus(`Downloaded ${matched}/${setlist.tracks.length} tracks — in Rekordbox go to File → Import Playlist and select the XML file.`);
    setTimeout(() => setCrateStatus(null), 10000);
  };

  const displayTracks = setlist
    ? setlist.tracks.map((t, i) => toDisplayTrack(t, i))
    : SAMPLE_TRACKS;
  const setlistName = setlist?.name ?? 'Friday Night Affair';
  const inp = setlist?.input;
  const genreLabel = inp
    ? `${inp.primaryGenre}${inp.secondaryGenre ? ` / ${inp.secondaryGenre}` : ''}`
    : 'Afrobeats / Hip Hop';
  const crowdLabel = inp?.crowdContext ?? 'Club';
  const durationLabel = inp ? `${inp.durationMinutes} min` : '90 min';
  const slotLabel = inp?.lineupSlot ?? 'Headliner';
  const dateLabel = setlist?.generatedAt
    ? new Date(setlist.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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
              {[genreLabel, crowdLabel, durationLabel, slotLabel, dateLabel].map((v, i) => (
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
            <SDButton ghost onClick={() => setlist?.dbSlug && router.push('/set/' + setlist.dbSlug)} style={{ fontSize:10, padding:'8px 16px' }}>
              Share ↗
            </SDButton>
            <SDButton style={{ fontSize:11, padding:'10px 24px' }} onClick={handleExportCrate}>
              Export Serato Crate
            </SDButton>
            <SDButton ghost style={{ fontSize:11, padding:'10px 24px' }} onClick={handleExportRekordbox}>
              Export Rekordbox XML
            </SDButton>
          </div>
        </div>

        {/* Library-only export toggle */}
        {setlist && setlist.tracks.some(t => t.isWishlistTrack) && (
          <div style={{ marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
            <button
              onClick={() => setLibraryOnly(v => !v)}
              style={{
                width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', padding:2,
                background: libraryOnly ? SD.accent : SD.surface2,
                transition:'background .15s', position:'relative', flexShrink:0,
              }}>
              <span style={{
                display:'block', width:16, height:16, borderRadius:'50%',
                background: libraryOnly ? '#000' : SD.textMuted,
                transform: libraryOnly ? 'translateX(16px)' : 'translateX(0)',
                transition:'transform .15s',
              }}/>
            </button>
            <span style={{ fontFamily:SD.mono, fontSize:11, color: libraryOnly ? SD.text : SD.textSec }}>
              Export library tracks only
            </span>
            <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted }}>
              ({setlist.tracks.filter(t => !t.isWishlistTrack).length} tracks — hides{' '}
              {setlist.tracks.filter(t => t.isWishlistTrack).length} wishlist tracks not yet purchased)
            </span>
          </div>
        )}

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
            <SDButton onClick={() => { setShowRegen(false); router.push('/builder'); }}>Rebuild</SDButton>
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
              <StatBox value={durationLabel} label="Duration" />
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
                color:SD.textMuted, textTransform:'uppercase', marginBottom:14 }}>Set Info</div>
              {[
                ['Genre', genreLabel],
                ['Crowd', crowdLabel],
                ['Slot', slotLabel],
              ].map(([label, value]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between',
                  marginBottom:10, alignItems:'baseline' }}>
                  <span style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
                    letterSpacing:1, textTransform:'uppercase' }}>{label}</span>
                  <span style={{ fontFamily:SD.mono, fontSize:11, color:SD.textSec }}>{value}</span>
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
                    {setlist?.dbSlug && (
                      <SDButton ghost full onClick={() => router.push('/set/' + setlist.dbSlug)} style={{ fontSize:10 }}>
                        Preview ↗
                      </SDButton>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted }}>
                  Generate a setlist to get a share link
                </div>
              )}
            </div>

            {setlist?.dbId && (
              <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
                borderRadius:4, padding:'18px 20px' }}>
                <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:2,
                  color:SD.textMuted, textTransform:'uppercase', marginBottom:12 }}>Gig Log</div>
                {gigLogged ? (
                  <div style={{ fontFamily:SD.mono, fontSize:11, color:SD.green }}>✓ Gig logged</div>
                ) : showGigForm ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <input
                      type="date"
                      value={gigDate}
                      onChange={e => setGigDate(e.target.value)}
                      style={{ background:SD.bg, border:`1px solid ${SD.border}`, borderRadius:3,
                        padding:'8px 12px', color:SD.text, fontFamily:SD.mono, fontSize:11,
                        outline:'none', width:'100%', boxSizing:'border-box' }}
                    />
                    <input
                      value={gigVenue}
                      onChange={e => setGigVenue(e.target.value)}
                      placeholder="Venue (optional)"
                      style={{ background:SD.bg, border:`1px solid ${SD.border}`, borderRadius:3,
                        padding:'8px 12px', color:SD.text, fontFamily:SD.mono, fontSize:11,
                        outline:'none', width:'100%', boxSizing:'border-box' }}
                      onFocus={e => (e.target.style.borderColor = SD.accent)}
                      onBlur={e => (e.target.style.borderColor = SD.border)}
                    />
                    <div style={{ display:'flex', gap:8 }}>
                      <SDButton onClick={handleLogGig} style={{ flex:1, fontSize:10, opacity: loggingGig ? 0.6 : 1 }}>
                        {loggingGig ? 'Logging...' : 'Log Gig'}
                      </SDButton>
                      <SDButton ghost onClick={() => setShowGigForm(false)} style={{ fontSize:10, padding:'8px 12px' }}>
                        Cancel
                      </SDButton>
                    </div>
                  </div>
                ) : (
                  <SDButton ghost full onClick={() => setShowGigForm(true)} style={{ fontSize:10 }}>
                    Mark as Played
                  </SDButton>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
