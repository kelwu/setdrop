'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { SD, ConfidenceStatus, SampleTrack } from '@/lib/setdrop/constants';

// ─── Nav ───────────────────────────────────────────────────────────────────
interface NavProps { page: string; setPage: (p: string) => void; user?: User | null; }
export function Nav({ page, setPage, user }: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const initials = user?.email ? user.email[0].toUpperCase() : 'DJ';

  const links = [
    { id:'dashboard', label:'Dashboard' },
    { id:'builder', label:'Build Set' },
    { id:'library', label:'Library' },
  ];
  return (
    <nav className="sd-pad-x" style={{
      position:'fixed', top:0, left:0, right:0, zIndex:200,
      height:56, display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 40px',
      background:'rgba(10,10,10,0.96)', backdropFilter:'blur(16px)',
      borderBottom:`1px solid ${SD.border}`,
    }}>
      <span onClick={() => setPage('landing')} style={{
        fontFamily:SD.display, fontSize:26, letterSpacing:4, cursor:'pointer', color:SD.text,
      }}>
        SET<span style={{ color:SD.accent }}>DROP</span>
      </span>
      <div className="sd-nav-links" style={{ display:'flex', alignItems:'center', gap:36 }}>
        {links.map(l => (
          <span key={l.id} onClick={() => setPage(l.id)} style={{
            fontFamily:SD.mono, fontSize:11, letterSpacing:1.5,
            textTransform:'uppercase', cursor:'pointer',
            color: page === l.id ? SD.accent : SD.textSec,
            borderBottom: page === l.id ? `1px solid ${SD.accent}` : '1px solid transparent',
            paddingBottom:2, transition:'color .15s',
          }}>{l.label}</span>
        ))}
        <SDButton onClick={() => setPage('builder')} small>Build Set</SDButton>
        <div ref={menuRef} style={{ position:'relative' }}>
          <div
            onClick={() => setMenuOpen(o => !o)}
            style={{
              width:30, height:30, borderRadius:'50%', cursor:'pointer',
              background:`linear-gradient(135deg,#F5A623,#FF6B35)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:SD.mono, fontSize:11, fontWeight:700, color:'#000',
            }}
          >{initials}</div>
          {menuOpen && (
            <div style={{
              position:'absolute', top:'calc(100% + 10px)', right:0,
              background:SD.surface2, border:`1px solid ${SD.border}`,
              borderRadius:3, minWidth:160, zIndex:300,
              boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {user && (
                <div style={{
                  padding:'10px 14px', borderBottom:`1px solid ${SD.border}`,
                  fontSize:11, color:SD.textSec, fontFamily:SD.mono,
                  letterSpacing:.3, wordBreak:'break-all',
                }}>
                  {user.email}
                </div>
              )}
              <div
                onClick={handleSignOut}
                style={{
                  padding:'10px 14px', fontSize:11, color:SD.red,
                  fontFamily:SD.mono, letterSpacing:1, textTransform:'uppercase',
                  cursor:'pointer', transition:'background .12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = SD.redDim)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Sign Out
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─── Button ────────────────────────────────────────────────────────────────
interface SDButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  small?: boolean;
  ghost?: boolean;
  danger?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: React.CSSProperties;
}
export function SDButton({ children, onClick, small, ghost, disabled, full, style: extraStyle = {} }: SDButtonProps) {
  const [hov, setHov] = useState(false);
  const base: React.CSSProperties = {
    fontFamily:SD.mono, letterSpacing:1, textTransform:'uppercase',
    border:'none', borderRadius:2, cursor: disabled ? 'not-allowed' : 'pointer',
    transition:'all .15s', display:'inline-flex', alignItems:'center', justifyContent:'center',
    gap:8, opacity: disabled ? 0.4 : 1,
    ...(full ? { width:'100%' } : {}),
    ...(small ? { fontSize:10, padding:'7px 16px' } : { fontSize:12, padding:'11px 24px' }),
  };
  if (ghost) {
    return (
      <button onClick={onClick} disabled={disabled} style={{ ...base,
        background: hov ? SD.accentDim : 'transparent',
        border:`1px solid ${hov ? SD.accent : SD.borderMid}`,
        color: hov ? SD.accent : SD.textSec,
        ...extraStyle,
      }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>{children}</button>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base,
      background: hov ? SD.accentHover : SD.accent,
      color:'#000', fontWeight:700,
      transform: hov ? 'scale(1.02)' : 'scale(1)',
      ...extraStyle,
    }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>{children}</button>
  );
}

// ─── ConfidenceBadge ───────────────────────────────────────────────────────
export function ConfidenceBadge({ status, label }: { status: ConfidenceStatus; label: string }) {
  const c = { green:SD.green, yellow:SD.yellow, red:SD.red }[status];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4,
      fontFamily:SD.mono, fontSize:10, color:SD.textSec, letterSpacing:.3 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:c, display:'inline-block',
        boxShadow:`0 0 5px ${c}66` }} />
      {label}
    </span>
  );
}

// ─── Energy dot ────────────────────────────────────────────────────────────
export function EnergyDot({ energy, size = 8 }: { energy: number; size?: number }) {
  const c = energy<=3?'#22C55E':energy<=6?'#EAB308':energy<=8?'#F5A623':'#EF4444';
  return <span style={{ width:size, height:size, borderRadius:'50%', background:c,
    display:'inline-block', boxShadow:`0 0 6px ${c}88`, flexShrink:0 }} />;
}

// ─── TrackRow ──────────────────────────────────────────────────────────────
export function TrackRow({ track }: { track: SampleTrack }) {
  const [exp, setExp] = useState(false);
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => setExp(!exp)}
      style={{
        background: hov ? SD.surface2 : SD.surface,
        border:`1px solid ${hov ? SD.borderMid : SD.border}`,
        borderLeft: track.wishlist ? `3px solid ${SD.accent}` : `1px solid ${SD.border}`,
        borderRadius:3, padding:'13px 16px', marginBottom:2,
        transition:'background .12s, border-color .12s', cursor:'pointer',
      }}>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <span style={{ fontFamily:SD.mono, fontSize:11, color:SD.textMuted,
          width:22, textAlign:'right', flexShrink:0 }}>
          {String(track.pos).padStart(2,'0')}
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontFamily:SD.mono, fontSize:13, fontWeight:600, color:SD.text }}>{track.artist}</span>
            <span style={{ fontFamily:SD.mono, fontSize:12, color:SD.textSec }}>— {track.title}</span>
          </div>
          <div style={{ display:'flex', gap:12, marginTop:3, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.accent, letterSpacing:.5 }}>{track.bpm} BPM</span>
            <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec }}>{track.key}</span>
            {track.wishlist && (
              <span style={{ fontFamily:SD.mono, fontSize:9, color:SD.accent,
                background:SD.accentDim, border:`1px solid ${SD.accent}44`,
                borderRadius:2, padding:'1px 6px', letterSpacing:.5, textTransform:'uppercase' }}>
                ⚠ Download before gig
              </span>
            )}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <EnergyDot energy={track.energy} />
          <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted }}>{track.energy}/10</span>
          {hov && !exp && (
            <div style={{ display:'flex', gap:8 }}>
              {(Object.entries(track.stores) as [string, ConfidenceStatus][]).map(([s, v]) => (
                <ConfidenceBadge key={s} status={v} label={s==='bpmSupreme'?'BPM':s[0].toUpperCase()+s.slice(1)} />
              ))}
            </div>
          )}
          <span style={{ fontFamily:SD.mono, fontSize:10, color:SD.textMuted, marginLeft:4 }}>{exp ? '▲' : '▼'}</span>
        </div>
      </div>
      {exp && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${SD.border}` }}>
          {track.why && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.accent, letterSpacing:1.5,
                textTransform:'uppercase', marginBottom:4 }}>Why this track</div>
              <div style={{ fontFamily:SD.mono, fontSize:11, color:SD.textSec, lineHeight:1.7 }}>{track.why}</div>
            </div>
          )}
          {track.transition && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textMuted, letterSpacing:1.5,
                textTransform:'uppercase', marginBottom:4 }}>Transition note</div>
              <div style={{ fontFamily:SD.mono, fontSize:11, color:SD.textMuted, lineHeight:1.7 }}>{track.transition}</div>
            </div>
          )}
          <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginTop:8 }}>
            {(Object.entries(track.stores) as [string, ConfidenceStatus][]).map(([s, v]) => (
              <ConfidenceBadge key={s} status={v}
                label={s==='bpmSupreme'?'BPM Supreme':s[0].toUpperCase()+s.slice(1)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GenrePillSelector ─────────────────────────────────────────────────────
interface GenrePillSelectorProps {
  selected: string | string[];
  onChange: (g: string) => void;
  genres: readonly string[];
}
export function GenrePillSelector({ selected, onChange, genres }: GenrePillSelectorProps) {
  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {genres.map(g => {
        const on = Array.isArray(selected) ? selected.includes(g) : selected === g;
        return (
          <button key={g} onClick={() => onChange(g)} style={{
            fontFamily:SD.mono, fontSize:11, letterSpacing:.5,
            textTransform:'uppercase', padding:'7px 16px', borderRadius:100,
            border:`1px solid ${on ? SD.accent : SD.border}`,
            background: on ? SD.accent : 'transparent',
            color: on ? '#000' : SD.textSec,
            cursor:'pointer', transition:'all .12s',
            transform: on ? 'scale(1.03)' : 'scale(1)',
          }}>{g}</button>
        );
      })}
    </div>
  );
}

// ─── Energy Arc Chart (static, read-only) ────────────────────────────────
export function EnergyArcChart({ tracks, width = 640, height = 200 }: {
  tracks: SampleTrack[]; width?: number; height?: number;
}) {
  const px = 44, py = 18;
  const cw = width - px*2, ch = height - py*2;
  const n = tracks.length;
  if (n < 2) return null;
  const pts = tracks.map((t, i) => [px + (i/(n-1))*cw, py + ch - (t.energy/10)*ch]);
  const d = pts.reduce((a, p, i) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const pr = pts[i-1], cx = (pr[0]+p[0])/2;
    return a + ` C${cx},${pr[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
  }, '');
  const fill = d + ` L${pts[n-1][0]},${py+ch} L${px},${py+ch}Z`;
  const gridLines = [0,2,4,6,8,10];
  return (
    <svg width={width} height={height} style={{ overflow:'visible', display:'block' }}>
      <defs>
        <linearGradient id="arcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SD.accent} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={SD.accent} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {gridLines.map(v => {
        const y = py + ch - (v/10)*ch;
        return (
          <g key={v}>
            <line x1={px} y1={y} x2={px+cw} y2={y} stroke={SD.border} strokeWidth={.5}/>
            <text x={px-8} y={y+4} textAnchor="end" fill={SD.textMuted}
              fontSize={9} fontFamily="var(--font-mono),monospace">{v}</text>
          </g>
        );
      })}
      <path d={fill} fill="url(#arcFill)"/>
      <path d={d} fill="none" stroke={SD.accent} strokeWidth={2}/>
      {pts.map((pt, i) => (
        <g key={i}>
          <circle cx={pt[0]} cy={pt[1]} r={4} fill={SD.accent} stroke={SD.bg} strokeWidth={1.5}/>
          <text x={pt[0]} y={py+ch+16} textAnchor="middle"
            fill={SD.textMuted} fontSize={8} fontFamily="var(--font-mono),monospace">
            {tracks[i].artist.split(' ')[0]}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Agent Progress ─────────────────────────────────────────────────────────
export function AgentProgress({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {steps.map((s, i) => {
        const done = i < currentStep, active = i === currentStep;
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{
              width:28, height:28, borderRadius:'50%', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
              background: done ? SD.accentDim : active ? `${SD.accent}18` : SD.surface2,
              border:`1px solid ${done ? SD.accent : active ? `${SD.accent}66` : SD.border}`,
              transition:'all .3s',
            }}>
              {done
                ? <span style={{ color:SD.accent, fontSize:12, fontWeight:700 }}>✓</span>
                : active
                ? <span style={{ width:8, height:8, borderRadius:'50%', background:SD.accent,
                    display:'block', animation:'sdPulse 1.2s ease-in-out infinite' }}/>
                : <span style={{ width:5, height:5, borderRadius:'50%', background:SD.borderMid, display:'block' }}/>
              }
            </div>
            <span style={{ fontFamily:SD.mono, fontSize:12,
              color: done ? SD.text : active ? SD.accent : SD.textMuted,
              transition:'color .3s' }}>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── SDInput ───────────────────────────────────────────────────────────────
interface SDInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  type?: string;
  style?: React.CSSProperties;
}
export function SDInput({ value, onChange, placeholder, label, type = 'text', style: extra = {} }: SDInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {label && <label style={{ fontFamily:SD.mono, fontSize:10, color:SD.textSec,
        letterSpacing:1.5, textTransform:'uppercase' }}>{label}</label>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background:SD.surface2, border:`1px solid ${focused ? SD.accent : SD.border}`,
          borderRadius:3, padding:'10px 14px', color:SD.text,
          fontFamily:SD.mono, fontSize:13, outline:'none',
          transition:'border-color .15s', ...extra,
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

// ─── Section label ──────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily:SD.mono, fontSize:9, color:SD.textSec,
      letterSpacing:2, textTransform:'uppercase', marginBottom:10,
      display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ flex:1, height:1, background:SD.border, display:'block' }}/>
      {children}
      <span style={{ flex:1, height:1, background:SD.border, display:'block' }}/>
    </div>
  );
}
