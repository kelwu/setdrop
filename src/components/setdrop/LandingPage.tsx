'use client';

import React, { useState } from 'react';
import { SD, SAMPLE_TRACKS } from '@/lib/setdrop/constants';
import { SDButton, TrackRow, EnergyArcChart } from './shared';

export function LandingPage({ setPage }: { setPage: (p: string) => void }) {
  const HOW_IT_WORKS = [
    { n:'01', label:'Discover', desc:"Connect Spotify. Save tracks to your wishlist as you listen. SetDrop watches your saves in real time." },
    { n:'02', label:'Enrich', desc:"AI enriches every track with BPM, key, energy score, and genre tags — no manual tagging." },
    { n:'03', label:'Bridge', desc:"SetDrop checks Beatport, Traxsource, and BPM Supreme to tell you where each track is purchasable." },
    { n:'04', label:'Sync', desc:"Download and import to Serato. SetDrop tracks what's in your library and what still needs to get there." },
    { n:'05', label:'Build', desc:"Set the gig context — genre, crowd, energy arc, duration. AI architects the perfect set from your library." },
    { n:'06', label:'Perform', desc:"Export your Serato crate file. Hit the decks. Do not repeat." },
  ];

  const FEATURES = [
    { title:'Spotify → Serato Pipeline', desc:"The only tool that closes the gap between discovering music on Spotify and playing it on Serato." },
    { title:'Do-Not-Repeat Logic', desc:"Tracks played in previous sets are flagged. AI never pulls from tracks you've already used this month." },
    { title:'Opener / Headliner Mode', desc:"Tell the AI your slot. Energy arc, track selection, and pacing adapt to your position on the lineup." },
    { title:'Genre-Specific Transition Rules', desc:"Afrobeats to House transitions follow different rules than Hip Hop to R&B. The AI knows." },
    { title:'Serato Crate Export', desc:"One click. Your setlist becomes a Serato crate file, ready to load before you hit the booth." },
    { title:'Gig Intel Agent', desc:"Provide the venue name. AI researches the room, resident DJs, and crowd profile to shape the set." },
  ];

  const DEMO_TRACKS = SAMPLE_TRACKS.slice(0, 5);

  return (
    <div style={{ background:SD.bg, minHeight:'100vh', color:SD.text }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="sd-hero-pad" style={{
        minHeight:'100vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', position:'relative',
        overflow:'hidden', padding:'120px 40px 80px', textAlign:'center',
      }}>
        {/* Grid background */}
        <div style={{
          position:'absolute', inset:0, zIndex:0,
          backgroundImage:`
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize:'60px 60px',
        }}/>

        {/* Amber glow */}
        <div style={{
          position:'absolute', bottom:'-10%', left:'50%', transform:'translateX(-50%)',
          width:900, height:420, borderRadius:'50%', zIndex:0,
          background:'radial-gradient(ellipse at center, rgba(245,166,35,0.1) 0%, transparent 68%)',
        }}/>

        {/* Speaker — left */}
        <svg className="sd-decorative" style={{ position:'absolute', left:'-20px', top:'50%', transform:'translateY(-50%)',
          opacity:.07, zIndex:0 }} width="180" height="380" viewBox="0 0 180 380" fill="none">
          <rect x="10" y="10" width="160" height="360" rx="8" fill="#F5A623"/>
          <circle cx="90" cy="70" r="28" fill="#0A0A0A" stroke="#F5A623" strokeWidth="3"/>
          <circle cx="90" cy="70" r="14" fill="#0A0A0A" stroke="#F5A623" strokeWidth="2"/>
          <circle cx="90" cy="70" r="5" fill="#F5A623"/>
          <circle cx="90" cy="230" r="80" fill="#0A0A0A" stroke="#F5A623" strokeWidth="3"/>
          <circle cx="90" cy="230" r="60" fill="#0A0A0A" stroke="#F5A623" strokeWidth="2"/>
          <circle cx="90" cy="230" r="40" fill="#0A0A0A" stroke="#F5A623" strokeWidth="1.5"/>
          <circle cx="90" cy="230" r="20" fill="#0A0A0A" stroke="#F5A623" strokeWidth="1"/>
          <circle cx="90" cy="230" r="6" fill="#F5A623"/>
          <rect x="30" y="330" width="120" height="18" rx="9" fill="#F5A623" opacity=".6"/>
        </svg>

        {/* Speaker — right */}
        <svg className="sd-decorative" style={{ position:'absolute', right:'-20px', top:'50%', transform:'translateY(-50%)',
          opacity:.07, zIndex:0 }} width="180" height="380" viewBox="0 0 180 380" fill="none">
          <rect x="10" y="10" width="160" height="360" rx="8" fill="#F5A623"/>
          <circle cx="90" cy="70" r="28" fill="#0A0A0A" stroke="#F5A623" strokeWidth="3"/>
          <circle cx="90" cy="70" r="14" fill="#0A0A0A" stroke="#F5A623" strokeWidth="2"/>
          <circle cx="90" cy="70" r="5" fill="#F5A623"/>
          <circle cx="90" cy="230" r="80" fill="#0A0A0A" stroke="#F5A623" strokeWidth="3"/>
          <circle cx="90" cy="230" r="60" fill="#0A0A0A" stroke="#F5A623" strokeWidth="2"/>
          <circle cx="90" cy="230" r="40" fill="#0A0A0A" stroke="#F5A623" strokeWidth="1.5"/>
          <circle cx="90" cy="230" r="20" fill="#0A0A0A" stroke="#F5A623" strokeWidth="1"/>
          <circle cx="90" cy="230" r="6" fill="#F5A623"/>
          <rect x="30" y="330" width="120" height="18" rx="9" fill="#F5A623" opacity=".6"/>
        </svg>

        {/* DJ Controller */}
        <svg className="sd-decorative" style={{ position:'absolute', top:'50%', left:'50%',
          transform:'translate(-50%,-50%)', opacity:.04, zIndex:0, pointerEvents:'none' }}
          width="900" height="360" viewBox="0 0 900 360" fill="none">
          <rect x="20" y="60" width="860" height="240" rx="24" fill="#F5A623"/>
          <circle cx="200" cy="180" r="110" fill="#0A0A0A" stroke="#F5A623" strokeWidth="4"/>
          <circle cx="200" cy="180" r="85" fill="#0A0A0A" stroke="#F5A623" strokeWidth="2"/>
          <circle cx="200" cy="180" r="60" fill="#0A0A0A" stroke="#F5A623" strokeWidth="1.5"/>
          <circle cx="200" cy="180" r="30" fill="#0A0A0A" stroke="#F5A623" strokeWidth="1"/>
          <circle cx="200" cy="180" r="10" fill="#F5A623"/>
          <circle cx="700" cy="180" r="110" fill="#0A0A0A" stroke="#F5A623" strokeWidth="4"/>
          <circle cx="700" cy="180" r="85" fill="#0A0A0A" stroke="#F5A623" strokeWidth="2"/>
          <circle cx="700" cy="180" r="60" fill="#0A0A0A" stroke="#F5A623" strokeWidth="1.5"/>
          <circle cx="700" cy="180" r="30" fill="#0A0A0A" stroke="#F5A623" strokeWidth="1"/>
          <circle cx="700" cy="180" r="10" fill="#F5A623"/>
          <rect x="350" y="90" width="200" height="180" rx="8" fill="#0A0A0A" stroke="#F5A623" strokeWidth="2"/>
          <rect x="365" y="230" width="170" height="16" rx="8" fill="#F5A623" opacity=".3"/>
          <rect x="415" y="226" width="30" height="24" rx="4" fill="#F5A623" opacity=".8"/>
          {([380,420,460,500] as number[]).map((x, i) => (
            <g key={i}>
              <rect x={x} y={100} width={8} height={110} rx={4} fill="#F5A623" opacity=".2"/>
              <rect x={x-4} y={110+(i%3)*20} width={16} height={20} rx={3} fill="#F5A623" opacity=".7"/>
            </g>
          ))}
          {([375,415,455,495,535] as number[]).map((x, i) => (
            <circle key={i} cx={x} cy={155} r={9} fill="#0A0A0A" stroke="#F5A623" strokeWidth="1.5" opacity=".8"/>
          ))}
          {([375,405,435,465] as number[]).map((x, i) => (
            <rect key={i} x={x} y={200} width={22} height={16} rx={3}
              fill="#F5A623" opacity={i===0?.8:.25}/>
          ))}
        </svg>

        {/* Crowd silhouette */}
        <svg style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:1,
          width:'100%', pointerEvents:'none' }}
          viewBox="0 0 1440 180" preserveAspectRatio="none" fill="none">
          <defs>
            <linearGradient id="crowdFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F5A623" stopOpacity="0.18"/>
              <stop offset="100%" stopColor="#F5A623" stopOpacity="0.06"/>
            </linearGradient>
          </defs>
          <path d="M0,140 C20,140 20,110 40,110 C60,110 60,125 80,120 C100,115 105,100 130,100 C155,100 158,118 180,115 C202,112 205,98 230,98 C255,98 258,112 280,112 C302,112 305,102 330,100 C355,98 360,115 385,112 C410,109 412,96 440,95 C468,94 470,110 500,108 C530,106 532,95 562,94 C592,93 595,108 625,106 C655,104 658,96 688,95 C718,94 720,110 750,108 C780,106 782,96 812,95 C842,94 845,108 875,107 C905,106 908,96 935,95 C962,94 965,112 995,110 C1025,108 1028,98 1055,97 C1082,96 1085,112 1112,110 C1139,108 1142,96 1170,95 C1198,94 1200,114 1230,112 C1260,110 1262,98 1290,97 C1318,96 1322,115 1350,112 C1378,109 1380,100 1410,100 C1430,100 1440,108 1440,108 L1440,180 L0,180 Z" fill="url(#crowdFade)"/>
          <path d="M0,155 C15,155 18,130 35,128 C52,126 55,145 75,142 C95,139 100,122 122,120 C144,118 148,138 170,136 C192,134 195,118 220,116 C245,114 248,135 272,133 C296,131 300,118 325,116 C350,114 353,136 378,133 C403,130 408,116 435,114 C462,112 465,132 492,130 C519,128 522,116 550,114 C578,112 580,134 608,132 C636,130 639,118 665,116 C691,114 694,135 720,132 C746,129 750,116 778,114 C806,112 808,134 835,132 C862,130 865,118 892,116 C919,114 922,136 948,133 C974,130 978,116 1005,114 C1032,112 1035,135 1062,132 C1089,129 1092,118 1118,116 C1144,114 1148,136 1175,133 C1202,130 1205,118 1230,116 C1255,114 1260,138 1285,135 C1310,132 1315,120 1340,118 C1365,116 1370,138 1395,135 C1420,132 1430,140 1440,138 L1440,180 L0,180 Z" fill="url(#crowdFade)" opacity=".8"/>
          {([120,240,380,520,660,800,940,1080,1220,1360] as number[]).map((x, i) => (
            <g key={i} opacity=".5">
              <line x1={x-18} y1={i%2===0?115:125} x2={x-32} y2={i%2===0?88:78}
                stroke="#F5A623" strokeWidth="3" strokeLinecap="round"/>
              <line x1={x+18} y1={i%2===0?115:125} x2={x+32} y2={i%2===0?82:92}
                stroke="#F5A623" strokeWidth="3" strokeLinecap="round"/>
            </g>
          ))}
        </svg>

        {/* Content */}
        <div style={{ position:'relative', zIndex:1, maxWidth:900 }}>
          <div style={{
            fontFamily:SD.mono, fontSize:11, letterSpacing:3,
            color:SD.accent, textTransform:'uppercase', marginBottom:24,
            display:'flex', alignItems:'center', justifyContent:'center', gap:12,
          }}>
            <span style={{ width:32, height:1, background:SD.accent, display:'inline-block' }}/>
            From Spotify to Serato
            <span style={{ width:32, height:1, background:SD.accent, display:'inline-block' }}/>
          </div>

          <h1 style={{
            fontFamily:SD.display, fontSize:'clamp(80px,14vw,160px)',
            letterSpacing:8, lineHeight:.9, margin:'0 0 8px', color:SD.text,
          }}>SET<span style={{ color:SD.accent }}>DROP</span></h1>

          <p style={{
            fontFamily:SD.mono, fontSize:16, color:SD.textSec,
            letterSpacing:1, lineHeight:1.7, margin:'32px auto 48px', maxWidth:560,
          }}>
            SetDrop connects your entire DJ workflow — from discovering tracks to exporting a Serato-ready crate file.
          </p>

          <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
            <SDButton onClick={() => setPage('builder')} style={{ fontSize:13, padding:'14px 36px' }}>
              Start Building Your Set
            </SDButton>
            <SDButton ghost
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior:'smooth' })}
              style={{ fontSize:13, padding:'14px 36px' }}>
              See It In Action
            </SDButton>
          </div>

          <div style={{ marginTop:64, display:'flex', gap:48, justifyContent:'center', flexWrap:'wrap' }}>
            {([['2,400+','Tracks analyzed'],['98%','Key accuracy'],['< 30s','Set generation']] as [string,string][]).map(([n, l]) => (
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:SD.display, fontSize:40, letterSpacing:2, color:SD.accent }}>{n}</div>
                <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted, letterSpacing:1.5,
                  textTransform:'uppercase', marginTop:4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position:'absolute', bottom:32, left:'50%', transform:'translateX(-50%)',
          display:'flex', flexDirection:'column', alignItems:'center', gap:6, zIndex:1 }}>
          <span style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted, letterSpacing:2,
            textTransform:'uppercase' }}>Scroll</span>
          <div style={{ width:1, height:32, background:`linear-gradient(${SD.accent},transparent)` }}/>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section className="sd-pad-x" style={{ padding:'120px 40px', maxWidth:1200, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:72 }}>
          <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:3, color:SD.accent,
            textTransform:'uppercase', marginBottom:12 }}>The Workflow</div>
          <h2 style={{ fontFamily:SD.display, fontSize:'clamp(48px,6vw,80px)', letterSpacing:4,
            margin:0, color:SD.text }}>HOW IT WORKS</h2>
        </div>
        <div className="sd-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1,
          border:`1px solid ${SD.border}` }}>
          {HOW_IT_WORKS.map((s, i) => (
            <div key={i} style={{
              padding:'40px 36px',
              background: i%2===0 ? SD.surface : SD.bg,
              borderRight: i%3!==2 ? `1px solid ${SD.border}` : 'none',
              borderBottom: i<3 ? `1px solid ${SD.border}` : 'none',
            }}>
              <div style={{ fontFamily:SD.display, fontSize:56, letterSpacing:2,
                color:'rgba(245,166,35,0.3)', lineHeight:1, marginBottom:12 }}>{s.n}</div>
              <div style={{ fontFamily:SD.display, fontSize:28, letterSpacing:2,
                color:SD.text, marginBottom:14 }}>{s.label.toUpperCase()}</div>
              <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textSec,
                lineHeight:1.8 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo Setlist ──────────────────────────────────────────────────── */}
      <section id="demo" className="sd-pad-x" style={{
        padding:'80px 40px 120px',
        background:SD.surface,
        borderTop:`1px solid ${SD.border}`,
        borderBottom:`1px solid ${SD.border}`,
      }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:3, color:SD.accent,
              textTransform:'uppercase', marginBottom:12 }}>Live Preview</div>
            <h2 style={{ fontFamily:SD.display, fontSize:'clamp(40px,5vw,64px)', letterSpacing:3,
              margin:'0 0 16px', color:SD.text }}>AI-GENERATED SETLIST</h2>
            <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textSec }}>
              Context: Afrobeats / Hip Hop · Club · 90 min · Headliner · Peak Hour arc
            </div>
          </div>
          <div style={{ background:SD.bg, border:`1px solid ${SD.border}`, borderRadius:4,
            padding:'24px 24px 8px', marginBottom:16, overflow:'hidden' }}>
            <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:2,
              color:SD.textMuted, textTransform:'uppercase', marginBottom:16 }}>Energy Arc</div>
            <div style={{ overflowX:'auto' }}>
              <EnergyArcChart tracks={DEMO_TRACKS} width={880} height={160} />
            </div>
          </div>
          <div>
            {DEMO_TRACKS.map(t => <TrackRow key={t.pos} track={t} />)}
          </div>
          <div style={{ textAlign:'center', marginTop:32 }}>
            <SDButton onClick={() => setPage('builder')}>Build Your Own Set</SDButton>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="sd-pad-x" style={{ padding:'120px 40px', maxWidth:1200, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:72 }}>
          <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:3, color:SD.accent,
            textTransform:'uppercase', marginBottom:12 }}>Why SetDrop</div>
          <h2 style={{ fontFamily:SD.display, fontSize:'clamp(40px,5vw,72px)', letterSpacing:4,
            margin:0, color:SD.text }}>BUILT FOR REAL DJs</h2>
        </div>
        <div className="sd-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1,
          border:`1px solid ${SD.border}` }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              padding:'36px 32px', background:SD.bg,
              borderRight: i%3!==2 ? `1px solid ${SD.border}` : 'none',
              borderBottom: i<3 ? `1px solid ${SD.border}` : 'none',
            }}>
              <div style={{ width:32, height:2, background:SD.accent, marginBottom:20 }}/>
              <div style={{ fontFamily:SD.display, fontSize:22, letterSpacing:2,
                color:SD.text, marginBottom:12 }}>{f.title.toUpperCase()}</div>
              <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textSec,
                lineHeight:1.8 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Platforms ─────────────────────────────────────────────────────── */}
      <section className="sd-pad-x" style={{ padding:'60px 40px', borderTop:`1px solid ${SD.border}`,
        borderBottom:`1px solid ${SD.border}`, background:SD.surface }}>
        <div style={{ maxWidth:800, margin:'0 auto', textAlign:'center' }}>
          <div style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:3, color:SD.textMuted,
            textTransform:'uppercase', marginBottom:32 }}>Works with your tools</div>
          <div style={{ display:'flex', justifyContent:'center', gap:64, flexWrap:'wrap', alignItems:'center' }}>
            {['Serato DJ Pro','Beatport','Spotify','Traxsource','BPM Supreme'].map(p => (
              <div key={p} style={{ fontFamily:SD.display, fontSize:18, letterSpacing:2,
                color:SD.textMuted }}>{p.toUpperCase()}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="sd-pad-x" style={{ padding:'140px 40px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{
          position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width:600, height:300, borderRadius:'50%',
          background:'radial-gradient(ellipse,rgba(245,166,35,0.06) 0%,transparent 70%)', zIndex:0,
        }}/>
        <div style={{ position:'relative', zIndex:1 }}>
          <h2 style={{ fontFamily:SD.display, fontSize:'clamp(48px,7vw,96px)',
            letterSpacing:4, margin:'0 0 24px', lineHeight:.95, color:SD.text }}>
            YOUR NEXT SET<br/><span style={{ color:SD.accent }}>STARTS HERE</span>
          </h2>
          <p style={{ fontFamily:SD.mono, fontSize:14, color:SD.textSec,
            margin:'0 auto 48px', maxWidth:480, lineHeight:1.8 }}>
            Connect your Spotify and start planning your next set. Free to start.
          </p>
          <SDButton onClick={() => setPage('builder')} style={{ fontSize:14, padding:'16px 48px' }}>
            Get Started — It&apos;s Free
          </SDButton>
          <div style={{ marginTop:20, fontFamily:SD.mono, fontSize:10, color:SD.textMuted }}>setdrop.app</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="sd-pad-x" style={{ borderTop:`1px solid ${SD.border}`, padding:'32px 40px',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
        <span style={{ fontFamily:SD.display, fontSize:20, letterSpacing:3, color:SD.textMuted }}>
          SET<span style={{ color:SD.accent }}>DROP</span>
        </span>
        <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted }}>
          © 2026 SetDrop · setdrop.app
        </span>
      </footer>
    </div>
  );
}
