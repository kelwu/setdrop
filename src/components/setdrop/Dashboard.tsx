'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SD, LIBRARY_TRACKS, ConfidenceStatus } from '@/lib/setdrop/constants';
import { SDButton, ConfidenceBadge } from './shared';

interface LibraryStats {
  totalTracks: number;
  lastSynced: string | null;
}

interface RecentSet {
  id: string;
  name: string;
  genre: string;
  date: string;
  duration: string;
  trackCount: number;
}

interface GigEntry {
  id: string;
  gigName: string;
  gigDate: string;
  venue: string | null;
  playedAt: string;
}

export function Dashboard({ setPage }: { setPage: (p: string) => void }) {
  const [libraryStats, setLibraryStats] = useState<LibraryStats | null>(null);
  const [recentSets, setRecentSets] = useState<RecentSet[] | null>(null);
  const [gigHistory, setGigHistory] = useState<GigEntry[] | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserEmail(user.email ?? null);

      const [libraryRes, setsRes, gigsRes] = await Promise.all([
        supabase
          .from('serato_libraries')
          .select('total_tracks, last_synced')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('setlists')
          .select('id, name, primary_genre, secondary_genre, crowd_context, duration_minutes, created_at, tracks_json')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('gig_history')
          .select('id, gig_name, gig_date, venue, played_at')
          .eq('user_id', user.id)
          .order('gig_date', { ascending: false })
          .limit(10),
      ]);

      if (libraryRes.data) {
        setLibraryStats({
          totalTracks: libraryRes.data.total_tracks,
          lastSynced: libraryRes.data.last_synced,
        });
      }

      if (setsRes.data) {
        setRecentSets(setsRes.data.map(s => {
          const trackCount = Array.isArray(s.tracks_json) ? (s.tracks_json as unknown[]).length : 0;
          const genre = [s.primary_genre, s.secondary_genre].filter(Boolean).join(' / ') || '—';
          const date = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const duration = s.duration_minutes ? `${s.duration_minutes} min` : '—';
          return { id: s.id, name: s.name, genre, date, duration, trackCount };
        }));
      }

      if (gigsRes.data) {
        setGigHistory(gigsRes.data.map(g => ({
          id: g.id,
          gigName: g.gig_name,
          gigDate: g.gig_date,
          venue: g.venue ?? null,
          playedAt: g.played_at,
        })));
      } else {
        setGigHistory([]);
      }
    });
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'GOOD MORNING';
    if (h < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  const djName = userEmail ? userEmail.split('@')[0].toUpperCase() : 'DJ';
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
              margin:0, color:SD.text, lineHeight:1 }}>{greeting()}, {djName}</h1>
          </div>
          <SDButton onClick={() => setPage('builder')} style={{ fontSize:13, padding:'13px 32px' }}>
            + Build New Set
          </SDButton>
        </div>

        {/* Stats row */}
        <div className="sd-grid-3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:16 }}>
          <Card>
            <CardHeader title="Serato Library" action={
              libraryStats ? (
                <span style={{ fontFamily:SD.mono, fontSize:9, color:SD.green,
                  display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:SD.green,
                    display:'inline-block', boxShadow:`0 0 6px ${SD.green}` }}/>
                  Synced
                </span>
              ) : null
            }/>
            <div style={{ padding:'28px 24px' }}>
              <div style={{ fontFamily:SD.display, fontSize:72, letterSpacing:2,
                color:SD.text, lineHeight:1 }}>
                {libraryStats ? libraryStats.totalTracks.toLocaleString() : '—'}
              </div>
              <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec,
                textTransform:'uppercase', letterSpacing:1.5, marginTop:4 }}>Tracks in library</div>
              {libraryStats?.lastSynced && (
                <div style={{ marginTop:20 }}>
                  <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
                    letterSpacing:1, textTransform:'uppercase' }}>
                    Last sync: {new Date(libraryStats.lastSynced).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                  </div>
                </div>
              )}
              <div style={{ marginTop:24 }}>
                <SDButton ghost onClick={() => setPage('library')} style={{ fontSize:10, padding:'7px 16px' }}>
                  {libraryStats ? 'Manage Library' : 'Upload Library'}
                </SDButton>
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
                color:SD.text, lineHeight:1 }}>
                {recentSets === null ? '—' : recentSets.filter(s => {
                  const d = new Date(s.date);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length}
              </div>
              <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec,
                textTransform:'uppercase', letterSpacing:1.5, marginTop:4 }}>Sets built</div>
              {recentSets && recentSets.length > 0 && (
                <div style={{ marginTop:20, display:'flex', gap:24 }}>
                  <div>
                    <div style={{ fontFamily:SD.mono, fontSize:16, fontWeight:600, color:SD.text }}>
                      {Math.round(recentSets.reduce((a, s) => a + s.trackCount, 0) / recentSets.length)}
                    </div>
                    <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
                      letterSpacing:1, textTransform:'uppercase', marginTop:2, lineHeight:1.4 }}>Avg tracks/set</div>
                  </div>
                </div>
              )}
              <div style={{ marginTop:24 }}>
                <SDButton ghost onClick={() => setPage('output')} style={{ fontSize:10, padding:'7px 16px' }}>
                  View History
                </SDButton>
              </div>
            </div>
          </Card>
        </div>

        {/* Gig History */}
        {gigHistory !== null && gigHistory.length > 0 && (
          <Card style={{ marginBottom:16 }}>
            <CardHeader title="Gig History" />
            <div style={{ padding:'16px' }}>
              {gigHistory.map((g, i) => (
                <div key={g.id} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'14px 8px',
                  borderBottom: i < gigHistory.length - 1 ? `1px solid ${SD.border}` : 'none',
                  gap:16,
                }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:SD.mono, fontSize:12, fontWeight:600,
                      color:SD.text, marginBottom:3,
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {g.gigName}
                    </div>
                    {g.venue && (
                      <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec }}>{g.venue}</div>
                    )}
                  </div>
                  <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted, flexShrink:0 }}>
                    {new Date(g.gigDate).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

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
              {recentSets === null ? (
                <div style={{ padding:'32px 16px', textAlign:'center',
                  fontFamily:SD.mono, fontSize:11, color:SD.textMuted }}>Loading...</div>
              ) : recentSets.length === 0 ? (
                <div style={{ padding:'32px 16px', textAlign:'center' }}>
                  <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textMuted, marginBottom:12 }}>
                    No sets yet
                  </div>
                  <SDButton onClick={() => setPage('builder')} style={{ fontSize:10 }}>Build Your First Set</SDButton>
                </div>
              ) : recentSets.map((s) => (
                <div key={s.id} onClick={() => setPage('output')}
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
                  <div style={{ display:'flex', gap:16, marginTop:14 }}>
                    {s.trackCount > 0 && (
                      <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec }}>{s.trackCount} tracks</span>
                    )}
                    <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec }}>{s.duration}</span>
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
