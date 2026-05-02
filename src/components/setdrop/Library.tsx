'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SD, LIBRARY_TRACKS, SampleTrack, ConfidenceStatus } from '@/lib/setdrop/constants';
import { LibraryTrack } from '@/lib/agents/types';
import { parseRekordboxXML } from '@/lib/setdrop/rekordbox-parser';
import { SDButton, SDInput, ConfidenceBadge, EnergyDot } from './shared';


function toDisplayTrack(t: LibraryTrack, idx: number): SampleTrack {
  return {
    pos: idx + 1,
    artist: t.artist,
    title: t.title,
    bpm: t.bpm,
    key: t.key || '—',
    energy: t.seratoEnergy ?? 5,
    wishlist: t.isWishlist,
    wordplay: null,
    why: '',
    transition: '',
    stores: { beatport: 'yellow', bpmSupreme: 'yellow', traxsource: 'yellow', spotify: 'yellow' },
  };
}

// ─── Store URL Builder ───────────────────────────────────────────────────────

function buildStoreUrls(artist: string, title: string) {
  const q = encodeURIComponent(`${artist} ${title}`);
  return {
    beatport_search_url: `https://www.beatport.com/search/tracks?q=${q}`,
    bpm_supreme_search_url: `https://www.bpmsupreme.com/search?q=${q}`,
    traxsource_search_url: `https://www.traxsource.com/search?term=${q}`,
  };
}

// ─── Library Row ─────────────────────────────────────────────────────────────

function LibraryRow({ track, tab, idx, onDelete, tags }: {
  track: SampleTrack; tab: string; idx: number; onDelete?: () => void; tags?: string[];
}) {
  const [hov, setHov] = useState(false);
  const statusColor = track.wishlist
    ? { bg:SD.accentDim, border:`${SD.accent}44`, text:SD.accent, label:'Wishlist' }
    : { bg:SD.greenDim, border:`${SD.green}44`, text:SD.green, label:'In Library' };
  const cols = tab === 'wishlist' ? '32px 1fr 64px 48px 64px 1fr 80px' : '32px 1fr 64px 48px 64px 80px 80px';

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position:'relative',
        display:'grid', gridTemplateColumns:cols,
        gap:12, padding:'13px 16px',
        background: hov ? SD.surface : 'transparent',
        borderBottom:`1px solid ${SD.border}`,
        transition:'background .12s', alignItems:'center',
      }}>
      <span style={{ fontFamily:SD.mono, fontSize:13, color:SD.textMuted }}>
        {String(track.pos).padStart(2,'0')}
      </span>
      <div style={{ minWidth:0 }}>
        <div style={{ fontFamily:SD.mono, fontSize:14, fontWeight:600, color:SD.text,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{track.artist}</div>
        <div style={{ fontFamily:SD.mono, fontSize:13, color:SD.textSec,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{track.title}</div>
        {hov && tags && tags.length > 0 && (
          <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap' }}>
            {tags.slice(0, 5).map(tag => (
              <span key={tag} style={{ fontFamily:SD.mono, fontSize:10, letterSpacing:.5,
                color:SD.textMuted, background:SD.surface2,
                border:`1px solid ${SD.border}`, borderRadius:2,
                padding:'1px 5px', textTransform:'lowercase' }}>{tag}</span>
            ))}
          </div>
        )}
      </div>
      <span style={{ fontFamily:SD.mono, fontSize:13, color:SD.accent }}>{track.bpm || '—'}</span>
      <span style={{ fontFamily:SD.mono, fontSize:13, color:SD.textSec }}>{track.key}</span>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <EnergyDot energy={track.energy} size={7} />
        <span style={{ fontFamily:SD.mono, fontSize:12, color:SD.textMuted }}>{track.energy}</span>
      </div>
      {tab === 'wishlist' ? (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {(Object.entries(track.stores) as [string, ConfidenceStatus][]).slice(0, 3).map(([s, v]) => (
            <ConfidenceBadge key={s} status={v}
              label={s==='bpmSupreme'?'BPM':s[0].toUpperCase()+s.slice(1)} />
          ))}
        </div>
      ) : (
        <span style={{ fontFamily:SD.mono, fontSize:12, color:SD.textMuted }}>
          {`Mar ${(idx % 28) + 1} 2026`}
        </span>
      )}
      {tab === 'wishlist' ? (
        <span style={{ fontFamily:SD.mono, fontSize:11, letterSpacing:.5, textTransform:'uppercase',
          padding:'3px 8px', borderRadius:2, background:statusColor.bg,
          border:`1px solid ${statusColor.border}`, color:statusColor.text, whiteSpace:'nowrap' }}>
          {statusColor.label}
        </span>
      ) : (
        <span style={{ fontFamily:SD.mono, fontSize:13, color:SD.textMuted }}>
          {(idx * 7 + 3) % 40}
        </span>
      )}
      {onDelete && hov && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
            background:'transparent', border:'none', cursor:'pointer',
            fontFamily:SD.mono, fontSize:14, color:SD.textMuted, lineHeight:1,
            padding:'4px 6px', borderRadius:2,
          }}
          title="Remove from wishlist"
        >✕</button>
      )}
    </div>
  );
}

// ─── Upload Zone ─────────────────────────────────────────────────────────────

type UploadMode = 'db' | 'rekordbox';

const SERATO_BLUE = '#1F6BFF';
const SERATO_BLUE_DIM = 'rgba(31,107,255,0.10)';
const SERATO_BLUE_BORDER = 'rgba(31,107,255,0.35)';

function UploadZone({
  onFile, dragOver, setDragOver, parseError, uploadMode, setUploadMode,
}: {
  onFile: (f: File) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  parseError: string | null;
  uploadMode: UploadMode;
  setUploadMode: (m: UploadMode) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const accept = uploadMode === 'db' ? '*' : '.xml,application/xml,text/xml';
  const dropLabel = uploadMode === 'db' ? 'DROP DATABASE V2 HERE' : 'DROP REKORDBOX XML HERE';
  const instructions = uploadMode === 'db' ? (
    <>
      Find the <span style={{ color:SD.textSec }}>_Serato_</span> folder inside your Music directory<br/>
      and drag the <span style={{ color:SD.accent }}>database V2</span> file here, or click to browse.
    </>
  ) : (
    <>
      In Rekordbox, go to <span style={{ color:SD.textSec }}>File → Export Collection in xml format</span><br/>
      then drag the <span style={{ color:SD.accent }}>rekordbox.xml</span> file here, or click to browse.
    </>
  );

  return (
    <div style={{ marginBottom:28 }}>
      {/* Brand selector cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
        {/* Serato card */}
        <button
          onClick={() => setUploadMode('db')}
          style={{
            background: uploadMode === 'db' ? SERATO_BLUE_DIM : SD.surface2,
            border: uploadMode === 'db' ? `2px solid ${SERATO_BLUE}` : `2px solid ${SERATO_BLUE_BORDER}`,
            borderRadius:4, padding:'20px 16px', cursor:'pointer',
            textAlign:'center', transition:'all .15s',
          }}
          onMouseEnter={e => { if (uploadMode !== 'db') e.currentTarget.style.borderColor = SERATO_BLUE; }}
          onMouseLeave={e => { if (uploadMode !== 'db') e.currentTarget.style.borderColor = SERATO_BLUE_BORDER; }}
        >
          <div style={{
            fontFamily:SD.display, fontSize:22, letterSpacing:3,
            color: SERATO_BLUE, marginBottom:6,
          }}>SERATO</div>
          <div style={{ fontFamily:SD.mono, fontSize:11, letterSpacing:2, color: uploadMode === 'db' ? SERATO_BLUE : SD.textMuted }}>
            DB V2
          </div>
        </button>

        {/* Rekordbox card */}
        <button
          onClick={() => setUploadMode('rekordbox')}
          style={{
            background: uploadMode === 'rekordbox' ? 'rgba(255,255,255,0.05)' : SD.surface2,
            border: uploadMode === 'rekordbox' ? `2px solid ${SD.text}` : `2px solid ${SD.borderMid}`,
            borderRadius:4, padding:'20px 16px', cursor:'pointer',
            textAlign:'center', transition:'all .15s',
          }}
          onMouseEnter={e => { if (uploadMode !== 'rekordbox') e.currentTarget.style.borderColor = SD.textSec; }}
          onMouseLeave={e => { if (uploadMode !== 'rekordbox') e.currentTarget.style.borderColor = SD.borderMid; }}
        >
          <div style={{
            fontFamily:SD.display, fontSize:22, letterSpacing:3,
            color: uploadMode === 'rekordbox' ? SD.text : SD.textSec, marginBottom:6,
          }}>REKORDBOX</div>
          <div style={{ fontFamily:SD.mono, fontSize:11, letterSpacing:2, color: uploadMode === 'rekordbox' ? SD.textSec : SD.textMuted }}>
            XML
          </div>
        </button>
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border:`2px dashed ${dragOver ? SD.accent : SD.borderMid}`,
          borderRadius:4, padding:'40px 32px', textAlign:'center', cursor:'pointer',
          background: dragOver ? SD.accentDim : SD.surface,
          transition:'all .15s',
        }}>
        <div style={{ fontFamily:SD.display, fontSize:32, letterSpacing:3,
          color: dragOver ? SD.accent : SD.textMuted, marginBottom:12 }}>
          {dropLabel}
        </div>
        <div style={{ fontFamily:SD.mono, fontSize:13, color:SD.textMuted, marginBottom:16, lineHeight:1.9 }}>
          {instructions}
        </div>
        <SDButton ghost style={{ fontSize:12, padding:'8px 20px' }}>Choose File</SDButton>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          style={{ display:'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>
      {parseError && (
        <div style={{ marginTop:12, padding:'12px 16px', background:'rgba(220,50,50,0.08)',
          border:'1px solid rgba(220,50,50,0.3)', borderRadius:3,
          fontFamily:SD.mono, fontSize:13, color:'#E05555' }}>
          {parseError}
        </div>
      )}
    </div>
  );
}

// ─── Library Screen ───────────────────────────────────────────────────────────

async function saveLibraryToSupabase(tracks: LibraryTrack[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Find or create the library row
  const { data: existing } = await supabase
    .from('serato_libraries')
    .select('id')
    .eq('user_id', user.id)
    .single();

  let libraryId: string;
  const now = new Date().toISOString();

  if (existing) {
    await supabase.from('serato_libraries')
      .update({ total_tracks: tracks.length, last_synced: now })
      .eq('id', existing.id);
    await supabase.from('serato_tracks').delete().eq('library_id', existing.id);
    libraryId = existing.id;
  } else {
    const { data } = await supabase.from('serato_libraries')
      .insert({ user_id: user.id, total_tracks: tracks.length, last_synced: now, is_public: false })
      .select('id').single();
    if (!data) return;
    libraryId = data.id;
  }

  // Batch insert tracks (500 at a time)
  const BATCH = 500;
  for (let i = 0; i < tracks.length; i += BATCH) {
    const rows = tracks.slice(i, i + BATCH).map(t => ({
      library_id: libraryId,
      artist: t.artist || null,
      title: t.title || null,
      bpm: t.bpm || null,
      key: t.key || null,
      genre: t.genre || null,
      file_path: t.filePath || null,
      play_count: 0,
      in_library: true,
    }));
    await supabase.from('serato_tracks').insert(rows);
  }
}

async function loadLibraryFromSupabase(): Promise<LibraryTrack[] | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const seratoTracks: LibraryTrack[] = [];

  const { data: library } = await supabase
    .from('serato_libraries')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (library) {
    const { data: tracks } = await supabase
      .from('serato_tracks')
      .select('id, artist, title, bpm, key, genre, file_path, lastfm_tags')
      .eq('library_id', library.id)
      .order('artist');
    if (tracks?.length) {
      seratoTracks.push(...tracks.map(t => ({
        id: t.id,
        artist: t.artist ?? '',
        title: t.title ?? '',
        bpm: t.bpm ?? 0,
        key: t.key ?? '',
        genre: t.genre ?? undefined,
        filePath: t.file_path ?? undefined,
        isWishlist: false,
        lastfmTags: t.lastfm_tags ?? [],
        enrichmentSource: 'serato' as const,
      })));
    }
  }

  const { data: wishlistRows } = await supabase
    .from('wishlist_tracks')
    .select('id, artist, title, bpm, key, genre, beatport_search_url, bpm_supreme_search_url, traxsource_search_url, lastfm_tags')
    .eq('user_id', user.id)
    .eq('status', 'wishlist')
    .order('added_at', { ascending: false });

  const wishlistTracks: LibraryTrack[] = (wishlistRows ?? []).map(w => ({
    id: w.id,
    artist: w.artist ?? '',
    title: w.title ?? '',
    bpm: w.bpm ?? 0,
    key: w.key ?? '',
    genre: w.genre ?? undefined,
    isWishlist: true,
    lastfmTags: Array.isArray(w.lastfm_tags) ? (w.lastfm_tags as string[]) : [],
    enrichmentSource: 'manual' as const,
    beatportSearchUrl: w.beatport_search_url ?? undefined,
    bpmSupremeSearchUrl: w.bpm_supreme_search_url ?? undefined,
    traxsourceSearchUrl: w.traxsource_search_url ?? undefined,
  }));

  if (!seratoTracks.length && !wishlistTracks.length) return null;
  return [...seratoTracks, ...wishlistTracks];
}

export function Library({ setPage }: { setPage: (p: string) => void }) {
  const [tab, setTab] = useState('library');
  const [search, setSearch] = useState('');
  const [bpmMin, setBpmMin] = useState('');
  const [bpmMax, setBpmMax] = useState('');
  const [uploadedTracks, setUploadedTracks] = useState<LibraryTrack[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>('db');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addArtist, setAddArtist] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addBpm, setAddBpm] = useState('');
  const [addKey, setAddKey] = useState('');
  const [addGenre, setAddGenre] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<{ id: string; name: string; trackCount: number }[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [showSpotifyPanel, setShowSpotifyPanel] = useState(false);

  useEffect(() => {
    // Try Supabase first, fall back to localStorage
    loadLibraryFromSupabase().then(tracks => {
      if (tracks) {
        setUploadedTracks(tracks);
        localStorage.setItem('sd_library', JSON.stringify(tracks));
      } else {
        try {
          const raw = localStorage.getItem('sd_library');
          if (raw) setUploadedTracks(JSON.parse(raw));
        } catch { /* ignore corrupted data */ }
      }
    });
  }, []);

  useEffect(() => {
    fetch('/api/spotify/status')
      .then(r => r.json())
      .then((d: { connected: boolean }) => setSpotifyConnected(d.connected))
      .catch(() => setSpotifyConnected(false));
  }, []);

  const loadSpotifyPlaylists = () => {
    fetch('/api/spotify/playlists')
      .then(r => r.json())
      .then((d: { playlists?: { id: string; name: string; trackCount: number }[] }) => {
        if (d.playlists) {
          setSpotifyPlaylists(d.playlists);
          if (d.playlists[0]) setSelectedPlaylist(d.playlists[0].id);
        }
      })
      .catch(() => {});
  };

  const handleSpotifyImport = async () => {
    if (!selectedPlaylist) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/spotify/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: selectedPlaylist }),
      });
      const data = await res.json() as { imported?: number; skipped?: number; error?: string };
      if (data.error) throw new Error(data.error);
      setImportResult({ imported: data.imported ?? 0, skipped: data.skipped ?? 0 });
      const tracks = await loadLibraryFromSupabase();
      if (tracks) { setUploadedTracks(tracks); localStorage.setItem('sd_library', JSON.stringify(tracks)); }
      fetch('/api/library/enrich-lastfm', { method: 'POST' }).catch(() => {});
    } catch (err) {
      setImportResult({ imported: -1, skipped: 0 });
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const handleSpotifyDisconnect = async () => {
    await fetch('/api/spotify/disconnect', { method: 'POST' });
    setSpotifyConnected(false);
    setSpotifyPlaylists([]);
    setShowSpotifyPanel(false);
  };

  const triggerEnrichment = () => {
    setEnriching(true);
    fetch('/api/library/enrich-lastfm', { method: 'POST' })
      .then(() => setEnriching(false))
      .catch(() => setEnriching(false));
  };

  const handleFile = (file: File) => {
    if (uploadMode === 'db') {
      setSaving(true);
      setParseError(null);
      const form = new FormData();
      form.append('file', file);
      fetch('/api/library/parse-db', { method: 'POST', body: form })
        .then(res => res.json())
        .then(async (data: { tracks?: LibraryTrack[]; error?: string }) => {
          if (data.error) throw new Error(data.error);
          const tracks = data.tracks!;
          localStorage.setItem('sd_library', JSON.stringify(tracks));
          setUploadedTracks(tracks);
          setParseError(null);
          setShowUpload(false);
          await saveLibraryToSupabase(tracks);
          setSaving(false);
          triggerEnrichment();
        })
        .catch(err => {
          setSaving(false);
          setParseError(err instanceof Error ? err.message : 'Failed to parse database V2 file');
        });
    } else {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const tracks = parseRekordboxXML(text);
          localStorage.setItem('sd_library', JSON.stringify(tracks));
          setUploadedTracks(tracks);
          setParseError(null);
          setShowUpload(false);
          setSaving(true);
          await saveLibraryToSupabase(tracks);
          setSaving(false);
          triggerEnrichment();
        } catch (err) {
          setSaving(false);
          setParseError(err instanceof Error ? err.message : 'Failed to parse Rekordbox XML');
        }
      };
      reader.readAsText(file);
    }
  };

  const clearLibrary = async () => {
    localStorage.removeItem('sd_library');
    setUploadedTracks(null);
    setShowUpload(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: library } = await supabase
        .from('serato_libraries')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (library) {
        await supabase.from('serato_tracks').delete().eq('library_id', library.id);
        await supabase.from('serato_libraries').delete().eq('id', library.id);
      }
    }
  };

  const handleAddWishlist = async () => {
    if (!addArtist.trim() || !addTitle.trim()) {
      setAddError('Artist and title are required.');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      const urls = buildStoreUrls(addArtist.trim(), addTitle.trim());
      const { error } = await supabase.from('wishlist_tracks').insert({
        user_id: user.id,
        artist: addArtist.trim(),
        title: addTitle.trim(),
        bpm: addBpm ? parseFloat(addBpm) : null,
        key: addKey.trim() || null,
        genre: addGenre.trim() || null,
        status: 'wishlist',
        enrichment_source: 'manual',
        ...urls,
      });
      if (error) throw error;
      setAddArtist(''); setAddTitle(''); setAddBpm(''); setAddKey(''); setAddGenre('');
      setShowAddForm(false);
      const tracks = await loadLibraryFromSupabase();
      if (tracks) { setUploadedTracks(tracks); localStorage.setItem('sd_library', JSON.stringify(tracks)); }
      fetch('/api/library/enrich-lastfm', { method: 'POST' }).catch(() => {});
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add track');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteWishlist = async (id: string) => {
    const supabase = createClient();
    await supabase.from('wishlist_tracks').delete().eq('id', id);
    const tracks = await loadLibraryFromSupabase();
    if (tracks) {
      setUploadedTracks(tracks);
      localStorage.setItem('sd_library', JSON.stringify(tracks));
    } else {
      const remaining = (uploadedTracks ?? []).filter(t => t.id !== id);
      setUploadedTracks(remaining.length ? remaining : null);
      localStorage.setItem('sd_library', JSON.stringify(remaining));
    }
  };

  const allTracks: SampleTrack[] = uploadedTracks
    ? uploadedTracks.map(toDisplayTrack)
    : LIBRARY_TRACKS;

  const wishlistTracks = allTracks.filter(t => t.wishlist);

  const matchFn = (t: SampleTrack) => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${t.artist} ${t.title}`.toLowerCase().includes(q);
    const matchBpm = (!bpmMin || t.bpm >= parseInt(bpmMin)) && (!bpmMax || t.bpm <= parseInt(bpmMax));
    if (tab === 'wishlist') return t.wishlist && matchSearch && matchBpm;
    return matchSearch && matchBpm;
  };

  const filteredRaw: LibraryTrack[] = (uploadedTracks ?? []).filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${t.artist} ${t.title}`.toLowerCase().includes(q);
    const matchBpm = (!bpmMin || t.bpm >= parseInt(bpmMin)) && (!bpmMax || t.bpm <= parseInt(bpmMax));
    if (tab === 'wishlist') return t.isWishlist && matchSearch && matchBpm;
    return matchSearch && matchBpm;
  });

  const filtered = uploadedTracks ? filteredRaw.map(toDisplayTrack) : allTracks.filter(matchFn);

  function TabBtn({ id, label, count }: { id: string; label: string; count: number }) {
    return (
      <button onClick={() => setTab(id)} style={{
        fontFamily:SD.mono, fontSize:13, letterSpacing:1.5, textTransform:'uppercase',
        padding:'10px 24px', border:'none', cursor:'pointer',
        background: tab === id ? SD.surface2 : 'transparent',
        color: tab === id ? SD.text : SD.textMuted,
        borderBottom: tab === id ? `2px solid ${SD.accent}` : '2px solid transparent',
        transition:'all .15s',
      }}>
        {label}
        <span style={{ marginLeft:8, fontFamily:SD.mono, fontSize:11,
          color: tab === id ? SD.accent : SD.textMuted }}>({count})</span>
      </button>
    );
  }

  const cols = tab === 'wishlist' ? '32px 1fr 64px 48px 64px 1fr 80px' : '32px 1fr 64px 48px 64px 80px 80px';
  const headers = ['#','Track','BPM','Key','Energy',
    tab === 'wishlist' ? 'Stores' : 'Date Added',
    tab === 'wishlist' ? 'Status' : 'Plays',
  ];

  return (
    <div style={{ background:SD.bg, minHeight:'100vh', paddingTop:56, color:SD.text }}>
      <div className="sd-pad-x sd-inner-pad" style={{ maxWidth:1100, margin:'0 auto', padding:'48px 40px' }}>

        {/* Header */}
        <div style={{ marginBottom:28, display:'flex', alignItems:'flex-end',
          justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontFamily:SD.mono, fontSize:11, color:SD.textMuted,
              letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Music Library</div>
            <h1 style={{ fontFamily:SD.display, fontSize:52, letterSpacing:4,
              margin:0, color:SD.text, lineHeight:1 }}>YOUR LIBRARY</h1>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {uploadedTracks ? (
              <>
                <span style={{ fontFamily:SD.mono, fontSize:12,
                  color: saving ? SD.accent : enriching ? SD.textSec : SD.green,
                  display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%',
                    background: saving ? SD.accent : enriching ? SD.textSec : SD.green,
                    display:'inline-block',
                    boxShadow:`0 0 6px ${saving ? SD.accent : enriching ? SD.textSec : SD.green}` }}/>
                  {saving ? 'Saving to cloud...' : enriching ? 'Fetching Last.fm tags...' : `${uploadedTracks.length.toLocaleString()} tracks loaded`}
                </span>
                <SDButton ghost onClick={() => setShowUpload(!showUpload)}
                  style={{ fontSize:12, padding:'7px 14px' }}>Replace Library</SDButton>
                <SDButton ghost danger onClick={clearLibrary}
                  style={{ fontSize:12, padding:'7px 14px', color:SD.textMuted }}>Clear</SDButton>
              </>
            ) : (
              <SDButton ghost onClick={() => setShowUpload(!showUpload)}
                style={{ fontSize:12, padding:'9px 18px' }}>
                + Upload Library
              </SDButton>
            )}
          </div>
        </div>

        {/* Upload zone — shown when toggled or when no library yet */}
        {(showUpload || (!uploadedTracks && tab === 'library')) && (
          <UploadZone
            onFile={handleFile}
            dragOver={dragOver}
            setDragOver={setDragOver}
            parseError={parseError}
            uploadMode={uploadMode}
            setUploadMode={setUploadMode}
          />
        )}

        {/* Tabs */}
        <div style={{ borderBottom:`1px solid ${SD.border}`, marginBottom:28 }}>
          <TabBtn id="library" label="In Library" count={allTracks.length} />
          <TabBtn id="wishlist" label="Wishlist" count={wishlistTracks.length} />
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:1, minWidth:240 }}>
            <SDInput value={search} onChange={setSearch}
              placeholder={tab === 'library' ? 'Search artist or title...' : 'Search wishlist...'} />
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <SDInput value={bpmMin} onChange={setBpmMin} placeholder="BPM min" style={{ width:80 }} />
            <span style={{ fontFamily:SD.mono, fontSize:12, color:SD.textMuted }}>—</span>
            <SDInput value={bpmMax} onChange={setBpmMax} placeholder="BPM max" style={{ width:80 }} />
          </div>
          {(search || bpmMin || bpmMax) && (
            <SDButton ghost onClick={() => { setSearch(''); setBpmMin(''); setBpmMax(''); }}
              style={{ fontSize:12, padding:'9px 14px' }}>Clear</SDButton>
          )}
        </div>

        <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textMuted, marginBottom:12 }}>
          {filtered.length} track{filtered.length !== 1 ? 's' : ''}{(search || bpmMin || bpmMax) ? ' matching filters' : ''}
          {uploadedTracks && <span style={{ color:SD.accent, marginLeft:8 }}>· Your Library</span>}
        </div>

        {/* Spotify import panel */}
        {tab === 'wishlist' && spotifyConnected !== null && (
          <div style={{ marginBottom: 16 }}>
            {!spotifyConnected ? (
              <a href="/api/spotify/auth" style={{ textDecoration: 'none' }}>
                <SDButton ghost style={{ fontSize: 12, padding: '8px 16px' }}>
                  ♫ Connect Spotify
                </SDButton>
              </a>
            ) : (
              <div>
                {!showSpotifyPanel ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <SDButton ghost onClick={() => { setShowSpotifyPanel(true); if (!spotifyPlaylists.length) loadSpotifyPlaylists(); }}
                      style={{ fontSize: 12, padding: '8px 16px' }}>
                      ♫ Import from Spotify
                    </SDButton>
                    <span style={{ fontFamily: SD.mono, fontSize: 11, color: SD.green }}>● Connected</span>
                    <button onClick={handleSpotifyDisconnect}
                      style={{ fontFamily: SD.mono, fontSize: 11, color: SD.textMuted,
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div style={{ background: SD.surface, border: `1px solid ${SD.border}`,
                    borderRadius: 4, padding: '20px 24px' }}>
                    <div style={{ fontFamily: SD.mono, fontSize: 11, letterSpacing: 2,
                      color: SD.textMuted, textTransform: 'uppercase', marginBottom: 16 }}>
                      Import from Spotify
                    </div>
                    {spotifyPlaylists.length === 0 ? (
                      <div style={{ fontFamily: SD.mono, fontSize: 13, color: SD.textMuted }}>
                        Loading playlists...
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                          value={selectedPlaylist}
                          onChange={e => setSelectedPlaylist(e.target.value)}
                          style={{
                            fontFamily: SD.mono, fontSize: 13, color: SD.text,
                            background: SD.surface2, border: `1px solid ${SD.border}`,
                            borderRadius: 3, padding: '8px 12px', cursor: 'pointer', flex: 1, minWidth: 200,
                          }}>
                          {spotifyPlaylists.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.trackCount} tracks)
                            </option>
                          ))}
                        </select>
                        <SDButton onClick={handleSpotifyImport} style={{ fontSize: 13 }}>
                          {importing ? 'Importing...' : 'Import'}
                        </SDButton>
                        <SDButton ghost onClick={() => { setShowSpotifyPanel(false); setImportResult(null); }}
                          style={{ fontSize: 13 }}>Cancel</SDButton>
                      </div>
                    )}
                    {importResult && (
                      <div style={{ marginTop: 12, fontFamily: SD.mono, fontSize: 13,
                        color: importResult.imported < 0 ? '#E05555' : SD.green }}>
                        {importResult.imported < 0
                          ? 'Import failed — check console'
                          : `✓ ${importResult.imported} tracks added${importResult.skipped ? `, ${importResult.skipped} already in wishlist` : ''}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Add to wishlist form */}
        {tab === 'wishlist' && (
          <div style={{ marginBottom:16 }}>
            {!showAddForm ? (
              <SDButton ghost onClick={() => setShowAddForm(true)}
                style={{ fontSize:12, padding:'8px 16px' }}>+ Add Track to Wishlist</SDButton>
            ) : (
              <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
                borderRadius:4, padding:'20px 24px' }}>
                <div style={{ fontFamily:SD.mono, fontSize:11, letterSpacing:2,
                  color:SD.textMuted, textTransform:'uppercase', marginBottom:16 }}>
                  Add Track to Wishlist
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <SDInput value={addArtist} onChange={setAddArtist} placeholder="Artist *" />
                  <SDInput value={addTitle} onChange={setAddTitle} placeholder="Title *" />
                  <SDInput value={addBpm} onChange={setAddBpm} placeholder="BPM" />
                  <SDInput value={addKey} onChange={setAddKey} placeholder="Key (e.g. 4A)" />
                </div>
                <div style={{ marginBottom:12 }}>
                  <SDInput value={addGenre} onChange={setAddGenre} placeholder="Genre (optional)" />
                </div>
                {addError && (
                  <div style={{ fontFamily:SD.mono, fontSize:13, color:'#E05555', marginBottom:10 }}>
                    {addError}
                  </div>
                )}
                <div style={{ display:'flex', gap:10 }}>
                  <SDButton onClick={handleAddWishlist} style={{ fontSize:13 }}>
                    {adding ? 'Adding...' : 'Add Track'}
                  </SDButton>
                  <SDButton ghost onClick={() => { setShowAddForm(false); setAddError(null); }}
                    style={{ fontSize:13 }}>Cancel</SDButton>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 40px' }}>
            <div style={{ fontFamily:SD.display, fontSize:48, letterSpacing:3,
              color:SD.textMuted, marginBottom:12 }}>NOTHING HERE</div>
            <div style={{ fontFamily:SD.mono, fontSize:14, color:SD.textMuted }}>
              {tab === 'wishlist'
                ? 'Add tracks you want to buy — they\'ll be included when generating your next set.'
                : 'Upload your Serato or Rekordbox library to see your tracks here.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
            <div style={{ minWidth:520 }}>
              {/* Table header */}
              <div style={{ display:'grid', gridTemplateColumns:cols, gap:12,
                padding:'8px 16px', borderBottom:`1px solid ${SD.border}` }}>
                {headers.map(h => (
                  <span key={h} style={{ fontFamily:SD.mono, fontSize:11, color:SD.textMuted,
                    letterSpacing:1.5, textTransform:'uppercase' }}>{h}</span>
                ))}
              </div>
              {filtered.map((t, idx) => (
                <LibraryRow
                  key={`${t.pos}-${idx}`}
                  track={t}
                  tab={tab}
                  idx={idx}
                  tags={filteredRaw[idx]?.lastfmTags}
                  onDelete={tab === 'wishlist' && uploadedTracks ? () => handleDeleteWishlist(filteredRaw[idx].id) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Wishlist actions */}
        {tab === 'wishlist' && filtered.length > 0 && (() => {
          const withLinks = (uploadedTracks ?? []).filter(t => t.isWishlist && t.beatportSearchUrl);
          const openCount = Math.min(withLinks.length, 5);
          return (
            <div style={{ marginTop:24, padding:'20px 24px',
              background:SD.accentDim, border:`1px solid ${SD.accent}33`,
              borderRadius:4, display:'flex', alignItems:'center',
              justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontFamily:SD.mono, fontSize:14, color:SD.text, marginBottom:4 }}>
                  {filtered.filter(t => t.wishlist).length} tracks ready to download
                </div>
                <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textSec }}>
                  Check store confidence before purchasing.
                </div>
              </div>
              {openCount > 0 && (
                <SDButton style={{ fontSize:13 }} onClick={() => {
                  withLinks.slice(0, 5).forEach(t => window.open(t.beatportSearchUrl, '_blank'));
                }}>
                  Open {openCount} Beatport Link{openCount !== 1 ? 's' : ''}
                </SDButton>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
