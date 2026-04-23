'use client';

import React, { useState, useRef } from 'react';
import { SD, GENRES, CROWD_TYPES, LINEUP_SLOTS, DURATION_OPTS, LIBRARY_TRACKS } from '@/lib/setdrop/constants';
import { GeneratedSetlist } from '@/lib/agents/types';
import { SDButton, GenrePillSelector, SDInput, AgentProgress } from './shared';

interface SetlistBuilderProps {
  setPage: (p: string) => void;
  onSetlistGenerated: (setlist: GeneratedSetlist) => void;
}

export function SetlistBuilder({ setPage, onSetlistGenerated }: SetlistBuilderProps) {
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);

  const [mixName, setMixName] = useState('');
  const [primaryGenre, setPrimaryGenre] = useState('');
  const [secondaryGenre, setSecondaryGenre] = useState('');
  const [vibe, setVibe] = useState('');
  const [crowd, setCrowd] = useState('');
  const [duration, setDuration] = useState('');
  const [slot, setSlot] = useState('');

  const [arcPoints, setArcPoints] = useState([3, 6, 9, 7, 4]);
  const arcLabels = ['Intro','Buildup','Peak','Sustain','Cooldown'];
  const arcPresets: Record<string, number[]> = {
    'Slow Burn': [2, 4, 7, 8, 5],
    'Peak Hour': [5, 7, 9, 9, 6],
    'Warm Down': [7, 6, 5, 4, 2],
  };
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);

  const [seedSearch, setSeedSearch] = useState('');
  const [soundcloudUrl, setSoundcloudUrl] = useState('');
  const [wordplay, setWordplay] = useState('');
  const [venueName, setVenueName] = useState('');

  const GEN_STEPS = [
    'Analyzing your library...',
    'Gathering gig intel...',
    'Architecting the set structure...',
    'Selecting and sequencing tracks...',
    'Reviewing transitions and flow...',
  ];

  const handleArcMouseDown = (i: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = i;
  };
  const handleArcMouseMove = (e: React.MouseEvent) => {
    if (dragging.current === null) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const raw = (e.clientY - rect.top) / rect.height;
    const energy = Math.max(0, Math.min(10, Math.round(10 - raw * 10)));
    setArcPoints(prev => prev.map((p, i) => i === dragging.current ? energy : p));
  };
  const handleArcMouseUp = () => { dragging.current = null; };

  const runGeneration = async () => {
    setGenerating(true);
    setGenStep(0);
    setGenError(null);

    // Animate steps while waiting for the API
    let s = 0;
    const iv = setInterval(() => {
      s = Math.min(s + 1, GEN_STEPS.length - 1);
      setGenStep(s);
    }, 2000);

    try {
      const durationMinutes = parseInt(duration) || 60;
      const res = await fetch('/api/generate-setlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: {
            name: mixName || 'Untitled Set',
            primaryGenre,
            secondaryGenre: secondaryGenre || undefined,
            vibe: vibe || undefined,
            crowdContext: crowd,
            durationMinutes,
            energyArc: {
              intro: arcPoints[0],
              buildup: arcPoints[1],
              peak: arcPoints[2],
              sustain: arcPoints[3],
              cooldown: arcPoints[4],
            },
            lineupSlot: slot,
            wordplayTheme: wordplay || undefined,
            venueContext: venueName || undefined,
          },
        }),
      });

      clearInterval(iv);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const setlist = await res.json() as GeneratedSetlist;
      setGenStep(GEN_STEPS.length);
      setTimeout(() => onSetlistGenerated(setlist), 400);
    } catch (err) {
      clearInterval(iv);
      setGenerating(false);
      setGenError(err instanceof Error ? err.message : 'Generation failed. Check your ANTHROPIC_API_KEY.');
    }
  };

  const stepValid = (s: number) => {
    if (s === 1) return primaryGenre && crowd && duration && slot;
    return true;
  };

  function StepIndicator() {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:48 }}>
        {[1,2,3].map((n, i) => (
          <React.Fragment key={n}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              <div style={{
                width:32, height:32, borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                background: step > n ? SD.accentDim : step === n ? SD.accent : SD.surface2,
                border:`1px solid ${step >= n ? SD.accent : SD.border}`,
                transition:'all .2s',
              }}>
                {step > n
                  ? <span style={{ color:SD.accent, fontSize:13 }}>✓</span>
                  : <span style={{ fontFamily:SD.mono, fontSize:11,
                      color: step === n ? '#000' : SD.textMuted }}>{n}</span>
                }
              </div>
              <span style={{ fontFamily:SD.mono, fontSize:9, letterSpacing:1.5,
                textTransform:'uppercase', color: step === n ? SD.accent : SD.textMuted }}>
                {['Gig Context','Energy Arc','Seeds'][i]}
              </span>
            </div>
            {i < 2 && (
              <div style={{ flex:1, height:1, marginBottom:24,
                background: step > n+1 ? SD.accent : step > n ? `linear-gradient(90deg,${SD.accent},${SD.border})` : SD.border,
                margin:'0 8px 24px',
              }}/>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  function ArcBuilder() {
    const W = 560, H = 220, px = 48, py = 24;
    const cw = W - px*2, ch = H - py*2;
    const n = arcPoints.length;
    const pts = arcPoints.map((e, i) => [px + (i/(n-1))*cw, py + ch - (e/10)*ch]);
    const d = pts.reduce((a, p, i) => {
      if (i === 0) return `M${p[0]},${p[1]}`;
      const pr = pts[i-1], cx = (pr[0]+p[0])/2;
      return a + ` C${cx},${pr[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
    }, '');
    const fill = d + ` L${pts[n-1][0]},${py+ch} L${px},${py+ch}Z`;
    return (
      <svg ref={svgRef} width={W} height={H}
        style={{ display:'block', cursor: dragging.current !== null ? 'ns-resize' : 'default', userSelect:'none' }}
        onMouseMove={handleArcMouseMove}
        onMouseUp={handleArcMouseUp}
        onMouseLeave={handleArcMouseUp}>
        <defs>
          <linearGradient id="builderArcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SD.accent} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={SD.accent} stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        {[0,2,4,6,8,10].map(v => {
          const y = py + ch - (v/10)*ch;
          return (
            <g key={v}>
              <line x1={px} y1={y} x2={px+cw} y2={y} stroke={SD.border} strokeWidth={.5}/>
              <text x={px-8} y={y+4} textAnchor="end" fill={SD.textMuted}
                fontSize={9} fontFamily="var(--font-mono),monospace">{v}</text>
            </g>
          );
        })}
        <path d={fill} fill="url(#builderArcFill)"/>
        <path d={d} fill="none" stroke={SD.accent} strokeWidth={2}/>
        {pts.map((pt, i) => (
          <g key={i} style={{ cursor:'ns-resize' }} onMouseDown={e => handleArcMouseDown(i, e)}>
            <circle cx={pt[0]} cy={pt[1]} r={10} fill="transparent"/>
            <circle cx={pt[0]} cy={pt[1]} r={5} fill={SD.accent} stroke={SD.bg} strokeWidth={2}/>
            <text x={pt[0]} y={py+ch+16} textAnchor="middle"
              fill={SD.textSec} fontSize={9} fontFamily="var(--font-mono),monospace">
              {arcLabels[i]}
            </text>
            <text x={pt[0]} y={pt[1]-10} textAnchor="middle"
              fill={SD.accent} fontSize={9} fontFamily="var(--font-mono),monospace">{arcPoints[i]}</text>
          </g>
        ))}
      </svg>
    );
  }

  const fieldStyle: React.CSSProperties = { display:'flex', flexDirection:'column', gap:6 };
  const labelStyle: React.CSSProperties = { fontFamily:SD.mono, fontSize:9, color:SD.textSec,
    letterSpacing:2, textTransform:'uppercase' };

  if (generating) {
    return (
      <div style={{ background:SD.bg, minHeight:'100vh', paddingTop:56,
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ maxWidth:480, width:'100%', padding:'0 40px' }}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <div style={{ fontFamily:SD.display, fontSize:56, letterSpacing:4,
              color:SD.text, marginBottom:8 }}>BUILDING</div>
            <div style={{ fontFamily:SD.display, fontSize:56, letterSpacing:4, color:SD.accent }}>YOUR SET</div>
            <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textSec, marginTop:16 }}>
              {mixName || 'New Set'} · {primaryGenre || 'Mixed'} · {duration || '60 min'}
            </div>
          </div>
          <AgentProgress steps={GEN_STEPS} currentStep={genStep} />
          <div style={{ marginTop:48, height:2, background:SD.surface2, borderRadius:2 }}>
            <div style={{
              height:'100%', background:SD.accent, borderRadius:2,
              width:`${(genStep / GEN_STEPS.length) * 100}%`,
              transition:'width 2s ease',
            }}/>
          </div>
          {genError && (
            <div style={{ marginTop:32, background:SD.redDim, border:`1px solid ${SD.red}44`,
              borderRadius:3, padding:'16px 20px', fontFamily:SD.mono, fontSize:12, color:SD.red,
              lineHeight:1.6 }}>
              ⚠ {genError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:SD.bg, minHeight:'100vh', paddingTop:56, color:SD.text }}>
      <div style={{ maxWidth:800, margin:'0 auto', padding:'48px 40px' }}>
        <div style={{ marginBottom:32 }}>
          <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
            letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Setlist Builder</div>
          <h1 style={{ fontFamily:SD.display, fontSize:52, letterSpacing:4,
            margin:0, color:SD.text, lineHeight:1 }}>BUILD YOUR SET</h1>
        </div>

        <StepIndicator />

        {/* Step 1 */}
        {step === 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:32 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              <SDInput label="Mix Name" value={mixName} onChange={setMixName}
                placeholder="e.g. Friday Night Affair" />
              <SDInput label="Venue Name (optional — Gig Intel)" value={venueName}
                onChange={setVenueName} placeholder="e.g. Fabric, London" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Primary Genre <span style={{ color:SD.accent }}>*</span></label>
              <GenrePillSelector selected={primaryGenre}
                onChange={g => setPrimaryGenre(g === primaryGenre ? '' : g)} genres={GENRES} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Secondary Genre (optional)</label>
              <GenrePillSelector selected={secondaryGenre}
                onChange={g => setSecondaryGenre(g === secondaryGenre ? '' : g)} genres={GENRES} />
            </div>
            <SDInput label="Vibe / Mood (optional)" value={vibe} onChange={setVibe}
              placeholder={`e.g. "dark and introspective" or "feel-good summer energy"`} />
            <div style={fieldStyle}>
              <label style={labelStyle}>Crowd Context <span style={{ color:SD.accent }}>*</span></label>
              <GenrePillSelector selected={crowd}
                onChange={g => setCrowd(g === crowd ? '' : g)} genres={CROWD_TYPES} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Set Duration <span style={{ color:SD.accent }}>*</span></label>
                <div style={{ display:'flex', gap:0, borderRadius:3, overflow:'hidden',
                  border:`1px solid ${SD.border}` }}>
                  {DURATION_OPTS.map((d, i) => (
                    <button key={d} onClick={() => setDuration(d)} style={{
                      flex:1, fontFamily:SD.mono, fontSize:11, letterSpacing:.5,
                      border:'none', borderLeft: i > 0 ? `1px solid ${SD.border}` : 'none',
                      background: duration === d ? SD.accent : SD.surface2,
                      color: duration === d ? '#000' : SD.textSec,
                      padding:'9px 4px', cursor:'pointer', transition:'all .12s',
                    }}>{d}</button>
                  ))}
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Lineup Slot <span style={{ color:SD.accent }}>*</span></label>
                <GenrePillSelector selected={slot}
                  onChange={g => setSlot(g === slot ? '' : g)} genres={LINEUP_SLOTS} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:32 }}>
            <div>
              <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textSec,
                lineHeight:1.8, marginBottom:24 }}>
                Drag the control points to shape your energy arc. Each point represents a phase of your set.
              </div>
              <div style={{ display:'flex', gap:10, marginBottom:28 }}>
                {Object.entries(arcPresets).map(([label, vals]) => (
                  <button key={label} onClick={() => setArcPoints(vals)} style={{
                    fontFamily:SD.mono, fontSize:10, letterSpacing:1, textTransform:'uppercase',
                    padding:'6px 16px', borderRadius:100, border:`1px solid ${SD.border}`,
                    background:'transparent', color:SD.textSec, cursor:'pointer', transition:'all .12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = SD.accent; e.currentTarget.style.color = SD.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = SD.border; e.currentTarget.style.color = SD.textSec; }}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
              borderRadius:4, padding:'24px 24px 16px', overflow:'hidden' }}>
              <ArcBuilder />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
              {arcLabels.map((label, i) => (
                <div key={label} style={{ background:SD.surface, border:`1px solid ${SD.border}`,
                  borderRadius:3, padding:'16px 12px', textAlign:'center' }}>
                  <div style={{ fontFamily:SD.display, fontSize:36, letterSpacing:2,
                    color:SD.accent, lineHeight:1 }}>{arcPoints[i]}</div>
                  <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
                    letterSpacing:1.5, textTransform:'uppercase', marginTop:4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
            <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.textSec, lineHeight:1.8 }}>
              Optional seeds help the AI ground your set in specific directions.
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Seed Track — Search your Serato library</label>
              <div style={{ position:'relative' }}>
                <SDInput value={seedSearch} onChange={setSeedSearch}
                  placeholder="Search by artist or title..." />
                {seedSearch && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10,
                    background:SD.surface2, border:`1px solid ${SD.border}`,
                    borderTop:'none', borderRadius:'0 0 3px 3px', overflow:'hidden' }}>
                    {LIBRARY_TRACKS
                      .filter(t => `${t.artist} ${t.title}`.toLowerCase().includes(seedSearch.toLowerCase()))
                      .slice(0, 4)
                      .map(t => (
                        <div key={t.pos} onClick={() => setSeedSearch(`${t.artist} — ${t.title}`)}
                          style={{ padding:'12px 16px', cursor:'pointer',
                            borderBottom:`1px solid ${SD.border}`, transition:'background .1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = SD.surface3)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ fontFamily:SD.mono, fontSize:12, color:SD.text }}>
                            {t.artist} — {t.title}
                          </div>
                          <div style={{ fontFamily:SD.mono, fontSize:10, color:SD.accent, marginTop:2 }}>
                            {t.bpm} BPM · {t.key}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <SDInput label="SoundCloud URL (optional)" value={soundcloudUrl} onChange={setSoundcloudUrl}
              placeholder="https://soundcloud.com/artist/track" />
            <SDInput label="Wordplay Theme (optional)" value={wordplay} onChange={setWordplay}
              placeholder={`e.g. "night", "love", "rise", "free"`} />
            <div style={{ background:SD.surface, border:`1px solid ${SD.border}`,
              borderRadius:3, padding:'20px 24px' }}>
              <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.accent,
                letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>Set Summary</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {([
                  ['Genre', `${primaryGenre}${secondaryGenre ? ` / ${secondaryGenre}` : ''}`],
                  ['Crowd', crowd],
                  ['Duration', duration],
                  ['Slot', slot],
                  ['Vibe', vibe || '—'],
                  ['Venue', venueName || '—'],
                  ['Arc', arcPoints.join(' → ')],
                  ['Seed', seedSearch || '—'],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ marginBottom:6 }}>
                    <span style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted,
                      letterSpacing:1.5, textTransform:'uppercase' }}>{k}: </span>
                    <span style={{ fontFamily:SD.mono, fontSize:11, color:SD.text }}>{v || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          marginTop:48, paddingTop:32, borderTop:`1px solid ${SD.border}` }}>
          {step > 1
            ? <SDButton ghost onClick={() => setStep(s => s-1)}>← Back</SDButton>
            : <span/>
          }
          {step < 3
            ? <SDButton onClick={() => setStep(s => s+1)} disabled={!stepValid(step)}>Continue →</SDButton>
            : <SDButton onClick={runGeneration} style={{ fontSize:14, padding:'14px 40px' }}>Drop the Set</SDButton>
          }
        </div>
      </div>
    </div>
  );
}
