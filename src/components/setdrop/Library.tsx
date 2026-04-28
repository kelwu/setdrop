'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SD, LIBRARY_TRACKS, SampleTrack, ConfidenceStatus } from '@/lib/setdrop/constants';
import { LibraryTrack } from '@/lib/agents/types';
import { SDButton, SDInput, ConfidenceBadge, EnergyDot } from './shared';

// ─── CSV Parser ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseSeratoCSV(text: string): LibraryTrack[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV has no tracks');

  const rawHeaders = parseCSVLine(lines[0]).map(h =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/^"|"$/g, '')
  );

  const idx = (keys: string[]) => {
    for (const k of keys) {
      const i = rawHeaders.indexOf(k);
      if (i >= 0) return i;
    }
    return -1;
  };

  const colName     = idx(['name', 'title', 'song', 'track_title', 'track']);
  const colArtist   = idx(['artist', 'artist_name']);
  const colBpm      = idx(['bpm', 'tempo']);
  const colKey      = idx(['key', 'musical_key']);
  const colGenre    = idx(['genre', 'style']);
  const colPlays    = idx(['play_count', 'plays', 'playcount']);
  const colLocation = idx(['location', 'file', 'filepath', 'file_path', 'path']);

  if (colName < 0 && colArtist < 0) {
    throw new Error('Could not find track name or artist columns. Is this a Serato CSV export?');
  }

  const tracks: LibraryTrack[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]);
    const get = (c: number) => c >= 0 ? (cols[c] ?? '').replace(/^"|"$/g, '').trim() : '';

    const artist = get(colArtist);
    const title  = get(colName);
    if (!artist && !title) continue;

    tracks.push({
      id: `csv-${i}`,
      artist,
      title,
      bpm:      parseFloat(get(colBpm)) || 0,
      key:      get(colKey),
      genre:    get(colGenre) || undefined,
      filePath: get(colLocation) || undefined,
      isWishlist: false,
      lastfmTags: [],
      seratoEnergy: undefined,
      enrichmentSource: 'serato',
    });
  }

  if (tracks.length === 0) throw new Error('No valid tracks found — check that the file is a Serato CSV export');
  return tracks;
}

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

// ─── Library Row ─────────────────────────────────────────────────────────────

function LibraryRow({ track, tab, idx }: { track: SampleTrack; tab: string; idx: number }) {
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
        display:'grid', gridTemplateColumns:cols,
        gap:12, padding:'13px 16px',
        background: hov ? SD.surface : 'transparent',
        borderBottom:`1px solid ${SD.border}`,
        transition:'background .12s', alignItems:'center',
      }}>
      <span style={{ fontFamily:SD.mono, fontSize:11, color:SD.textMuted }}>
        {String(track.pos).padStart(2,'0')}
      </span>
      <div style={{ minWidth:0 }}>
        <div style={{ fontFamily:SD.mono, fontSize:12, fontWeight:600, color:SD.text,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{track.artist}</div>
        <div style={{ fontFamily:SD.mono, fontSize:11, color:SD.textSec,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{track.title}</div>
      </div>
      <span style={{ fontFamily:SD.mono, fontSize:11, color:SD.accent }}>{track.bpm || '—'}</span>
      <span style={{ fontFamily:SD.mono, fontSize:11, color:SD.textSec }}>{track.key}</span>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <EnergyDot energy={track.energy} size={7} />
        <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted }}>{track.energy}</span>
      </div>
      {tab === 'wishlist' ? (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {(Object.entries(track.stores) as [string, ConfidenceStatus][]).slice(0, 3).map(([s, v]) => (
            <ConfidenceBadge key={s} status={v}
              label={s==='bpmSupreme'?'BPM':s[0].toUpperCase()+s.slice(1)} />
          ))}
        </div>
      ) : (
        <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted }}>
          {`Mar ${(idx % 28) + 1} 2026`}
        </span>
      )}
      {tab === 'wishlist' ? (
        <span style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:.5, textTransform:'uppercase',
          padding:'3px 8px', borderRadius:2, background:statusColor.bg,
          border:`1px solid ${statusColor.border}`, color:statusColor.text, whiteSpace:'nowrap' }}>
          {statusColor.label}
        </span>
      ) : (
        <span style={{ fontFamily:SD.mono, fontSize:11, color:SD.textMuted }}>
          {(idx * 7 + 3) % 40}
        </span>
      )}
    </div>
  );
}

// ─── Upload Zone ─────────────────────────────────────────────────────────────

type UploadMode = 'db' | 'csv';

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

  const isDb = uploadMode === 'db';

  return (
    <div style={{ marginBottom:28 }}>
      {/* Mode tabs */}
      <div style={{ display:'flex', marginBottom:12, borderBottom:`1px solid ${SD.border}` }}>
        {(['db', 'csv'] as UploadMode[]).map(m => (
          <button key={m} onClick={() => setUploadMode(m)} style={{
            fontFamily:SD.mono, fontSize:10, letterSpacing:1.5, textTransform:'uppercase',
            padding:'8px 20px', border:'none', cursor:'pointer',
            background: uploadMode === m ? SD.surface2 : 'transparent',
            color: uploadMode === m ? SD.text : SD.textMuted,
            borderBottom: uploadMode === m ? `2px solid ${SD.accent}` : '2px solid transparent',
            transition:'all .15s',
          }}>
            {m === 'db' ? 'Database V2' : 'History CSV'}
          </button>
        ))}
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
          {isDb ? 'DROP DATABASE V2 HERE' : 'DROP CSV HERE'}
        </div>
        <div style={{ fontFamily:SD.mono, fontSize:11, color:SD.textMuted, marginBottom:16, lineHeight:1.9 }}>
          {isDb ? (
            <>
              Find the <span style={{ color:SD.textSec }}>_Serato_</span> folder inside your Music directory<br/>
              and drag the <span style={{ color:SD.accent }}>database V2</span> file here, or click to browse.
            </>
          ) : (
            <>
              In Serato, open the <span style={{ color:SD.textSec }}>History</span> panel,
              right-click a session → <span style={{ color:SD.textSec }}>Export as .csv</span><br/>
              Then drag the file here. Note: History only includes tracks you&apos;ve played.
            </>
          )}
        </div>
        <SDButton ghost style={{ fontSize:10, padding:'8px 20px' }}>Choose File</SDButton>
        <input
          ref={fileRef}
          type="file"
          accept={isDb ? '*' : '.csv,text/csv'}
          style={{ display:'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>
      {parseError && (
        <div style={{ marginTop:12, padding:'12px 16px', background:'rgba(220,50,50,0.08)',
          border:'1px solid rgba(220,50,50,0.3)', borderRadius:3,
          fontFamily:SD.mono, fontSize:11, color:'#E05555' }}>
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

  const { data: library } = await supabase
    .from('serato_libraries')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!library) return null;

  const { data: tracks } = await supabase
    .from('serato_tracks')
    .select('id, artist, title, bpm, key, genre, file_path')
    .eq('library_id', library.id)
    .order('artist');
  if (!tracks?.length) return null;

  return tracks.map((t) => ({
    id: t.id,
    artist: t.artist ?? '',
    title: t.title ?? '',
    bpm: t.bpm ?? 0,
    key: t.key ?? '',
    genre: t.genre ?? undefined,
    filePath: t.file_path ?? undefined,
    isWishlist: false,
    lastfmTags: [],
    enrichmentSource: 'serato' as const,
  }));
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
          const tracks = parseSeratoCSV(text);
          localStorage.setItem('sd_library', JSON.stringify(tracks));
          setUploadedTracks(tracks);
          setParseError(null);
          setShowUpload(false);
          setSaving(true);
          await saveLibraryToSupabase(tracks);
          setSaving(false);
        } catch (err) {
          setSaving(false);
          setParseError(err instanceof Error ? err.message : 'Failed to parse CSV');
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

  const allTracks: SampleTrack[] = uploadedTracks
    ? uploadedTracks.map(toDisplayTrack)
    : LIBRARY_TRACKS;

  const wishlistTracks = allTracks.filter(t => t.wishlist);

  const filtered = allTracks.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${t.artist} ${t.title}`.toLowerCase().includes(q);
    const matchBpm = (!bpmMin || t.bpm >= parseInt(bpmMin)) && (!bpmMax || t.bpm <= parseInt(bpmMax));
    if (tab === 'wishlist') return t.wishlist && matchSearch && matchBpm;
    return matchSearch && matchBpm;
  });

  function TabBtn({ id, label, count }: { id: string; label: string; count: number }) {
    return (
      <button onClick={() => setTab(id)} style={{
        fontFamily:SD.mono, fontSize:11, letterSpacing:1.5, textTransform:'uppercase',
        padding:'10px 24px', border:'none', cursor:'pointer',
        background: tab === id ? SD.surface2 : 'transparent',
        color: tab === id ? SD.text : SD.textMuted,
        borderBottom: tab === id ? `2px solid ${SD.accent}` : '2px solid transparent',
        transition:'all .15s',
      }}>
        {label}
        <span style={{ marginLeft:8, fontFamily:SD.mono, fontSize:9,
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
            <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
              letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Music Library</div>
            <h1 style={{ fontFamily:SD.display, fontSize:52, letterSpacing:4,
              margin:0, color:SD.text, lineHeight:1 }}>YOUR LIBRARY</h1>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {uploadedTracks ? (
              <>
                <span style={{ fontFamily:SD.mono, fontSize:10, color: saving ? SD.accent : SD.green,
                  display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background: saving ? SD.accent : SD.green,
                    display:'inline-block', boxShadow:`0 0 6px ${saving ? SD.accent : SD.green}` }}/>
                  {saving ? 'Saving to cloud...' : `${uploadedTracks.length.toLocaleString()} tracks loaded`}
                </span>
                <SDButton ghost onClick={() => setShowUpload(!showUpload)}
                  style={{ fontSize:10, padding:'7px 14px' }}>Replace Library</SDButton>
                <SDButton ghost danger onClick={clearLibrary}
                  style={{ fontSize:10, padding:'7px 14px', color:SD.textMuted }}>Clear</SDButton>
              </>
            ) : (
              <SDButton ghost onClick={() => setShowUpload(!showUpload)}
                style={{ fontSize:10, padding:'9px 18px' }}>
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
          <TabBtn id="library" label="In Serato Library" count={allTracks.length} />
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
            <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted }}>—</span>
            <SDInput value={bpmMax} onChange={setBpmMax} placeholder="BPM max" style={{ width:80 }} />
          </div>
          {(search || bpmMin || bpmMax) && (
            <SDButton ghost onClick={() => { setSearch(''); setBpmMin(''); setBpmMax(''); }}
              style={{ fontSize:10, padding:'9px 14px' }}>Clear</SDButton>
          )}
        </div>

        <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted, marginBottom:12 }}>
          {filtered.length} track{filtered.length !== 1 ? 's' : ''}{(search || bpmMin || bpmMax) ? ' matching filters' : ''}
          {uploadedTracks && <span style={{ color:SD.accent, marginLeft:8 }}>· Your Serato Library</span>}
        </div>

        {/* Table header */}
        <div style={{ display:'grid', gridTemplateColumns:cols, gap:12,
          padding:'8px 16px', borderBottom:`1px solid ${SD.border}` }}>
          {headers.map(h => (
            <span key={h} style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
              letterSpacing:1.5, textTransform:'uppercase' }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 40px' }}>
            <div style={{ fontFamily:SD.display, fontSize:48, letterSpacing:3,
              color:SD.textMuted, marginBottom:12 }}>NOTHING HERE</div>
            <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textMuted }}>
              {tab === 'wishlist'
                ? 'Save tracks from Spotify to start building your wishlist.'
                : 'Upload your Serato library CSV to see your tracks here.'}
            </div>
          </div>
        ) : (
          filtered.map((t, idx) => <LibraryRow key={t.pos} track={t} tab={tab} idx={idx} />)
        )}

        {/* Wishlist actions */}
        {tab === 'wishlist' && filtered.length > 0 && (
          <div style={{ marginTop:24, padding:'20px 24px',
            background:SD.accentDim, border:`1px solid ${SD.accent}33`,
            borderRadius:4, display:'flex', alignItems:'center',
            justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.text, marginBottom:4 }}>
                {filtered.filter(t => t.wishlist).length} tracks ready to download
              </div>
              <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec }}>
                Check store confidence before purchasing.
              </div>
            </div>
            <SDButton style={{ fontSize:11 }}>Open All Store Links</SDButton>
          </div>
        )}
      </div>
    </div>
  );
}
