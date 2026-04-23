'use client';

import React from 'react';
import { SD, SAMPLE_TRACKS, ConfidenceStatus } from '@/lib/setdrop/constants';
import { GeneratedSetlist } from '@/lib/agents/types';
import { SDButton, EnergyArcChart, EnergyDot, ConfidenceBadge } from './shared';

export function PublicShare({ setPage, setlist }: { setPage: (p: string) => void; setlist: GeneratedSetlist | null }) {
  const tracks = setlist
    ? setlist.tracks.map((t, i) => ({
        pos: t.position || i + 1, artist: t.artist, title: t.title,
        bpm: t.bpm, key: t.key, energy: t.energyLevel, wishlist: t.isWishlistTrack,
        wordplay: t.wordplayConnection ?? null, why: t.whyThisTrack, transition: t.transitionNotes,
        stores: { beatport: 'green' as ConfidenceStatus, bpmSupreme: 'yellow' as ConfidenceStatus,
          traxsource: 'yellow' as ConfidenceStatus, spotify: 'green' as ConfidenceStatus },
      }))
    : SAMPLE_TRACKS;
  const name = setlist?.name ?? 'Friday Night Affair';
  return (
    <div style={{ background:SD.bg, minHeight:'100vh', color:SD.text }}>
      <div style={{ padding:'20px 40px', borderBottom:`1px solid ${SD.border}`,
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontFamily:SD.display, fontSize:22, letterSpacing:3,
          cursor:'pointer', color:SD.text }} onClick={() => setPage('landing')}>
          SET<span style={{ color:SD.accent }}>DROP</span>
        </span>
        <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted, letterSpacing:1.5 }}>
          Built with SetDrop
        </span>
      </div>

      <div style={{ maxWidth:820, margin:'0 auto', padding:'64px 40px' }}>
        <div style={{ marginBottom:48 }}>
          <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
            letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>
            DJ Name · Apr 22 2026
          </div>
          <h1 style={{ fontFamily:SD.display, fontSize:'clamp(48px,7vw,96px)',
            letterSpacing:4, margin:'0 0 12px', lineHeight:.95, color:SD.text }}>
            {name.toUpperCase()}
          </h1>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:16 }}>
            {['Afrobeats / Hip Hop','Club','90 min','8 tracks'].map((v, i) => (
              <span key={i} style={{ fontFamily:SD.mono, fontSize:11, color:SD.textSec }}>
                {i > 0 && <span style={{ color:SD.textMuted, marginRight:16 }}>·</span>}
                {v}
              </span>
            ))}
          </div>
        </div>

        <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
          borderRadius:4, padding:'20px 20px 10px', marginBottom:24, overflow:'hidden' }}>
          <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:2,
            color:SD.textMuted, textTransform:'uppercase', marginBottom:14 }}>Energy Arc</div>
          <div style={{ overflowX:'auto' }}>
            <EnergyArcChart tracks={tracks} width={760} height={150} />
          </div>
        </div>

        <div style={{ marginBottom:40 }}>
          <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:2,
            color:SD.textSec, textTransform:'uppercase', marginBottom:12 }}>Tracklist</div>
          {tracks.map(t => (
            <div key={t.pos} style={{ display:'flex', alignItems:'center', gap:16,
              padding:'14px 16px', borderBottom:`1px solid ${SD.border}` }}>
              <span style={{ fontFamily:SD.mono, fontSize:11, color:SD.textMuted,
                width:22, textAlign:'right', flexShrink:0 }}>
                {String(t.pos).padStart(2,'0')}
              </span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontFamily:SD.mono, fontSize:13, fontWeight:600,
                    color:SD.text }}>{t.artist}</span>
                  <span style={{ fontFamily:SD.mono, fontSize:12, color:SD.textSec }}>— {t.title}</span>
                </div>
                <div style={{ display:'flex', gap:10, marginTop:3 }}>
                  <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.accent }}>{t.bpm} BPM</span>
                  <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec }}>{t.key}</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                <EnergyDot energy={t.energy} />
                <div style={{ display:'flex', gap:6 }}>
                  {(Object.entries(t.stores) as [string, ConfidenceStatus][]).slice(0, 3).map(([s, v]) => (
                    <ConfidenceBadge key={s} status={v}
                      label={s==='bpmSupreme'?'BPM':s[0].toUpperCase()+s.slice(1)} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign:'center', padding:'56px 40px',
          border:`1px solid ${SD.border}`, borderRadius:4,
          background:SD.surface, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:'50%', left:'50%',
            transform:'translate(-50%,-50%)', width:400, height:200, borderRadius:'50%',
            background:'radial-gradient(ellipse,rgba(245,166,35,0.06) 0%,transparent 70%)' }}/>
          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ fontFamily:SD.display, fontSize:'clamp(28px,4vw,48px)',
              letterSpacing:3, color:SD.text, marginBottom:16 }}>
              BUILD YOUR OWN SET
            </div>
            <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textSec, marginBottom:28 }}>
              AI-powered setlist planning. Spotify to Serato in minutes.
            </div>
            <SDButton onClick={() => setPage('landing')} style={{ fontSize:13, padding:'13px 36px' }}>
              Try SetDrop Free
            </SDButton>
            <div style={{ marginTop:14, fontFamily:SD.mono, fontSize:10, color:SD.textMuted }}>
              setdrop.app
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
