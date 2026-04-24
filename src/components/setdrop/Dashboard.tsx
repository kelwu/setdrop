'use client';

import React from 'react';
import { SD, LIBRARY_TRACKS, ConfidenceStatus } from '@/lib/setdrop/constants';
import { SDButton, ConfidenceBadge } from './shared';

export function Dashboard({ setPage }: { setPage: (p: string) => void }) {
  const recentSets = [
    { name:'Friday Night Affair', genre:'Afrobeats / House', date:'Apr 18 2026', duration:'90 min', tracks:18, slug:'friday-night-affair' },
    { name:'Sunday Sessions Vol.3', genre:'R&B / Hip Hop', date:'Apr 12 2026', duration:'60 min', tracks:14, slug:'sunday-sessions-3' },
    { name:'Rooftop Summer Mix', genre:'Afrobeats / Dancehall', date:'Apr 5 2026', duration:'120 min', tracks:22, slug:'rooftop-summer' },
  ];

  const wishlistTracks = LIBRARY_TRACKS.filter(t => t.wishlist);

  function Card({ children, style: extra = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
      <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
        borderRadius:4, ...extra }}>{children}</div>
    );
  }

  function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'18px 24px', borderBottom:`1px solid ${SD.border}` }}>
        <span style={{ fontFamily:SD.mono, fontSize:10, letterSpacing:2,
          textTransform:'uppercase', color:SD.textSec }}>{title}</span>
        {action}
      </div>
    );
  }

  return (
    <div style={{ background:SD.bg, minHeight:'100vh', paddingTop:56, color:SD.text }}>
      <div className="sd-pad-x sd-inner-pad" style={{ maxWidth:1280, margin:'0 auto', padding:'48px 40px' }}>

        {/* Header */}
        <div style={{ marginBottom:40, display:'flex', alignItems:'flex-end',
          justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
          <div>
            <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted,
              letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>Dashboard</div>
            <h1 style={{ fontFamily:SD.display, fontSize:52, letterSpacing:4,
              margin:0, color:SD.text, lineHeight:1 }}>GOOD EVENING, DJ</h1>
          </div>
          <SDButton onClick={() => setPage('builder')} style={{ fontSize:13, padding:'13px 32px' }}>
            + Build New Set
          </SDButton>
        </div>

        {/* Stats row */}
        <div className="sd-grid-3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:16 }}>
          <Card>
            <CardHeader title="Serato Library" action={
              <span style={{ fontFamily:SD.mono, fontSize:9, color:SD.green,
                display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:SD.green,
                  display:'inline-block', boxShadow:`0 0 6px ${SD.green}` }}/>
                Synced
              </span>
            }/>
            <div style={{ padding:'28px 24px' }}>
              <div style={{ fontFamily:SD.display, fontSize:72, letterSpacing:2,
                color:SD.text, lineHeight:1 }}>2,418</div>
              <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec,
                textTransform:'uppercase', letterSpacing:1.5, marginTop:4 }}>Tracks in library</div>
              <div style={{ marginTop:20, display:'flex', gap:24 }}>
                {([['847','Crates'],['12','Genres'],['4h ago','Last sync']] as [string,string][]).map(([v, l]) => (
                  <div key={l}>
                    <div style={{ fontFamily:SD.mono, fontSize:16, fontWeight:600, color:SD.text }}>{v}</div>
                    <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
                      letterSpacing:1, textTransform:'uppercase', marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:24 }}>
                <SDButton ghost style={{ fontSize:10, padding:'7px 16px' }}>Sync Now</SDButton>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Wishlist" action={
              <span style={{ fontFamily:SD.mono, fontSize:9, color:SD.accent }}>
                {wishlistTracks.length} tracks
              </span>
            }/>
            <div style={{ padding:'28px 24px' }}>
              <div style={{ fontFamily:SD.display, fontSize:72, letterSpacing:2,
                color:SD.accent, lineHeight:1 }}>{wishlistTracks.length}</div>
              <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec,
                textTransform:'uppercase', letterSpacing:1.5, marginTop:4 }}>Tracks to download</div>
              <div style={{ marginTop:20, display:'flex', gap:24 }}>
                {([['3','Ready on Beatport'],['2','Check manually']] as [string,string][]).map(([v, l]) => (
                  <div key={l}>
                    <div style={{ fontFamily:SD.mono, fontSize:16, fontWeight:600, color:SD.text }}>{v}</div>
                    <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
                      letterSpacing:1, textTransform:'uppercase', marginTop:2, maxWidth:72, lineHeight:1.4 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:24 }}>
                <SDButton ghost onClick={() => setPage('library')} style={{ fontSize:10, padding:'7px 16px' }}>
                  View Wishlist
                </SDButton>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="This Month"/>
            <div style={{ padding:'28px 24px' }}>
              <div style={{ fontFamily:SD.display, fontSize:72, letterSpacing:2,
                color:SD.text, lineHeight:1 }}>3</div>
              <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec,
                textTransform:'uppercase', letterSpacing:1.5, marginTop:4 }}>Sets built</div>
              <div style={{ marginTop:20, display:'flex', gap:24 }}>
                {([['64','Avg tracks/set'],['94 min','Avg duration']] as [string,string][]).map(([v, l]) => (
                  <div key={l}>
                    <div style={{ fontFamily:SD.mono, fontSize:16, fontWeight:600, color:SD.text }}>{v}</div>
                    <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
                      letterSpacing:1, textTransform:'uppercase', marginTop:2, lineHeight:1.4 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:24 }}>
                <SDButton ghost onClick={() => setPage('output')} style={{ fontSize:10, padding:'7px 16px' }}>
                  View History
                </SDButton>
              </div>
            </div>
          </Card>
        </div>

        {/* Bottom row */}
        <div className="sd-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Card>
            <CardHeader title="Wishlist — Download Queue" action={
              <SDButton ghost onClick={() => setPage('library')} style={{ fontSize:9, padding:'5px 12px' }}>
                View All
              </SDButton>
            }/>
            <div style={{ padding:'16px' }}>
              {wishlistTracks.map(t => (
                <div key={t.pos} style={{ display:'flex', alignItems:'center', gap:14,
                  padding:'12px 8px', borderBottom:`1px solid ${SD.border}` }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:SD.mono, fontSize:12, fontWeight:600,
                      color:SD.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {t.artist} — {t.title}
                    </div>
                    <div style={{ display:'flex', gap:10, marginTop:3 }}>
                      <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.accent }}>{t.bpm} BPM</span>
                      <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec }}>{t.key}</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
                    {(Object.entries(t.stores) as [string, ConfidenceStatus][]).map(([s, v]) => (
                      <ConfidenceBadge key={s} status={v}
                        label={s==='bpmSupreme'?'BPM':s[0].toUpperCase()+s.slice(1)} />
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ padding:'16px 8px 0' }}>
                <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted }}>
                  + {Math.max(0, wishlistTracks.length - 2)} more tracks in wishlist
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent Setlists" action={
              <SDButton ghost onClick={() => setPage('output')} style={{ fontSize:9, padding:'5px 12px' }}>
                View All
              </SDButton>
            }/>
            <div style={{ padding:'16px' }}>
              {recentSets.map((s, i) => (
                <div key={i} onClick={() => setPage('output')}
                  style={{ padding:'18px 16px', marginBottom:8,
                    background:SD.bg, border:`1px solid ${SD.border}`,
                    borderRadius:3, cursor:'pointer', transition:'border-color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = SD.borderMid)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = SD.border)}>
                  <div style={{ display:'flex', alignItems:'flex-start',
                    justifyContent:'space-between', gap:8 }}>
                    <div>
                      <div style={{ fontFamily:SD.mono, fontSize:13, fontWeight:600,
                        color:SD.text, marginBottom:6 }}>{s.name}</div>
                      <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec }}>{s.genre}</div>
                    </div>
                    <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted, flexShrink:0 }}>{s.date}</span>
                  </div>
                  <div style={{ display:'flex', gap:16, marginTop:14,
                    alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', gap:16 }}>
                      <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec }}>{s.tracks} tracks</span>
                      <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec }}>{s.duration}</span>
                    </div>
                    <span style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
                      cursor:'pointer', textDecoration:'underline' }}>
                      setdrop.app/set/{s.slug}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
