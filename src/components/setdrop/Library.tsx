'use client';

import React, { useState } from 'react';
import { SD, LIBRARY_TRACKS, SampleTrack, ConfidenceStatus } from '@/lib/setdrop/constants';
import { SDButton, SDInput, ConfidenceBadge, EnergyDot } from './shared';

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
      <span style={{ fontFamily:SD.mono, fontSize:11, color:SD.accent }}>{track.bpm}</span>
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

export function Library({ setPage }: { setPage: (p: string) => void }) {
  const [tab, setTab] = useState('library');
  const [search, setSearch] = useState('');
  const [bpmMin, setBpmMin] = useState('');
  const [bpmMax, setBpmMax] = useState('');

  const filtered = LIBRARY_TRACKS.filter(t => {
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
        <div style={{ marginBottom:36 }}>
          <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
            letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Music Library</div>
          <h1 style={{ fontFamily:SD.display, fontSize:52, letterSpacing:4,
            margin:0, color:SD.text, lineHeight:1 }}>YOUR LIBRARY</h1>
        </div>

        <div style={{ borderBottom:`1px solid ${SD.border}`, marginBottom:28 }}>
          <TabBtn id="library" label="In Serato Library" count={LIBRARY_TRACKS.length} />
          <TabBtn id="wishlist" label="Wishlist" count={LIBRARY_TRACKS.filter(t => t.wishlist).length} />
        </div>

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
        </div>

        <div style={{ display:'grid', gridTemplateColumns:cols, gap:12,
          padding:'8px 16px', borderBottom:`1px solid ${SD.border}` }}>
          {headers.map(h => (
            <span key={h} style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
              letterSpacing:1.5, textTransform:'uppercase' }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 40px' }}>
            <div style={{ fontFamily:SD.display, fontSize:48, letterSpacing:3,
              color:SD.textMuted, marginBottom:12 }}>NOTHING HERE</div>
            <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textMuted }}>
              {tab === 'wishlist'
                ? 'Save tracks from Spotify to start building your wishlist.'
                : 'Connect Serato to sync your library.'}
            </div>
          </div>
        ) : (
          filtered.map((t, idx) => <LibraryRow key={t.pos} track={t} tab={tab} idx={idx} />)
        )}

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
