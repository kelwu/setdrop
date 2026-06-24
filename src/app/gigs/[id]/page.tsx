'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Nav } from '@/components/setdrop/shared';
import { PageHeader, Card, CardHeader, Tabs, EmptyState, LoadingState, SDButton } from '@/components/setdrop/shared';
import { SD } from '@/lib/setdrop/constants';
import {
  chunkMix, scanChunks, formatTimestamp,
  type MixSegmentMatch, type ScanProgress, type ScanChunk,
} from '@/lib/setdrop/mix-scanner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlannedTrack {
  position: number;
  artist: string;
  title: string;
  bpm: number | null;
  energyLevel: number;
}

interface ActualTrack {
  position: number;
  artist: string;
  title: string;
  timestamp?: number;
  source: 'scan' | 'manual';
}

interface DiffEntry {
  position: number;
  planned: { artist: string; title: string; energyLevel: number } | null;
  actual: { artist: string; title: string } | null;
  status: 'matched' | 'swapped' | 'skipped' | 'added';
}

interface ReflectionData {
  diff: DiffEntry[];
  energySummary: string;
  patterns: string[];
  swapCount: number;
  matchCount: number;
  skippedCount: number;
}

interface GigData {
  id: string;
  gigName: string | null;
  gigDate: string | null;
  venue: string | null;
  playedAt: string;
  setlistName: string | null;
  actualTracks: ActualTrack[] | null;
  reflectionJson: ReflectionData | null;
}

type InputMode = 'recording' | 'manual';
type PageStage = 'loading' | 'input' | 'scanning' | 'reflecting' | 'results' | 'error';

// ─── Energy Arc SVG ───────────────────────────────────────────────────────────

function EnergyArcComparison({ planned, diff }: { planned: PlannedTrack[]; diff: DiffEntry[] }) {
  const W = 560;
  const H = 140;
  const PAD = { top: 12, bottom: 28, left: 28, right: 12 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (planned.length < 2) return null;

  const toX = (i: number, total: number) => PAD.left + (i / (total - 1)) * innerW;
  const toY = (e: number) => PAD.top + innerH - (e / 10) * innerH;

  // Planned arc points
  const plannedPts = planned.map((t, i) => ({ x: toX(i, planned.length), y: toY(t.energyLevel) }));
  const plannedPath = plannedPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Actual arc — matched/swapped keep planned energy, skipped are gaps, added get energy 5
  const actualPts: ({ x: number; y: number } | null)[] = diff.map((d, i) => {
    if (d.status === 'skipped') return null;
    const e = d.planned?.energyLevel ?? 5;
    return { x: toX(i, diff.length), y: toY(e) };
  });
  const actualPath = actualPts
    .map((p, i) => {
      if (!p) return null;
      const prev = actualPts.slice(0, i).reverse().find(Boolean);
      return prev ? `L${p.x.toFixed(1)},${p.y.toFixed(1)}` : `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(' ');

  // Y-axis labels
  const yLabels = [0, 5, 10];

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {/* Grid lines */}
        {yLabels.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={toY(v)} y2={toY(v)}
              stroke={SD.border} strokeWidth={1} />
            <text x={PAD.left - 4} y={toY(v) + 4} textAnchor="end"
              fill={SD.textMuted} fontSize={9} fontFamily={SD.mono}>{v}</text>
          </g>
        ))}
        {/* Planned arc */}
        <path d={plannedPath} fill="none" stroke={SD.info} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
        {/* Actual arc */}
        {actualPath && (
          <path d={actualPath} fill="none" stroke={SD.accent} strokeWidth={2} />
        )}
        {/* Skipped markers */}
        {diff.map((d, i) => d.status === 'skipped' ? (
          <circle key={i} cx={toX(i, diff.length)} cy={toY(d.planned?.energyLevel ?? 5)}
            r={3} fill={SD.danger} opacity={0.7} />
        ) : null)}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontFamily: SD.mono, fontSize: SD.t10 }}>
        <span style={{ color: SD.info }}>── ── Planned</span>
        <span style={{ color: SD.accent }}>——— Actual</span>
        <span style={{ color: SD.danger }}>● Skipped</span>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: DiffEntry['status'] }) {
  const map: Record<DiffEntry['status'], { label: string; color: string; bg: string }> = {
    matched: { label: 'matched', color: SD.success, bg: SD.successDim },
    swapped:  { label: 'swapped',  color: SD.warning, bg: SD.warningDim },
    skipped:  { label: 'skipped',  color: SD.danger,  bg: SD.dangerDim  },
    added:    { label: 'added',    color: SD.info,    bg: SD.infoDim    },
  };
  const s = map[status];
  return (
    <span style={{ fontFamily: SD.mono, fontSize: SD.t10, letterSpacing: 1, textTransform: 'uppercase',
      color: s.color, background: s.bg, padding: '2px 7px', borderRadius: SD.r1 }}>
      {s.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GigReflectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [stage, setStage] = useState<PageStage>('loading');
  const [gig, setGig] = useState<GigData | null>(null);
  const [plannedTracks, setPlannedTracks] = useState<PlannedTrack[]>([]);
  const [reflection, setReflection] = useState<ReflectionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Input mode
  const [inputMode, setInputMode] = useState<InputMode>('recording');

  // Recording upload / scan
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const chunksRef = useRef<ScanChunk[] | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanSegments, setScanSegments] = useState<MixSegmentMatch[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  // Manual entry
  const [manualRows, setManualRows] = useState<{ artist: string; title: string }[]>(
    Array.from({ length: 10 }, () => ({ artist: '', title: '' }))
  );

  // ── Load gig data ──
  useEffect(() => {
    fetch(`/api/gigs/${id}/reflect`)
      .then(r => r.json())
      .then((data: { gig?: GigData; plannedTracks?: PlannedTrack[]; error?: string }) => {
        if (data.error || !data.gig) { setError(data.error ?? 'Not found'); setStage('error'); return; }
        setGig(data.gig);
        setPlannedTracks(data.plannedTracks ?? []);
        if (data.gig.reflectionJson) {
          setReflection(data.gig.reflectionJson);
          setStage('results');
        } else {
          if (data.plannedTracks?.length) {
            setManualRows(Array.from({ length: Math.max(data.plannedTracks.length, 10) }, () => ({ artist: '', title: '' })));
          }
          setStage('input');
        }
      })
      .catch(() => { setError('Failed to load gig'); setStage('error'); });
  }, [id]);

  // ── Recording upload ──
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanFile(file);
    setScanError(null);
    setScanSegments([]);
    setStage('scanning');
    setScanProgress(null);
    try {
      const { chunks } = await chunkMix(file);
      chunksRef.current = chunks;
      const sessionId = `reflect-${id}-${Date.now()}`;
      const segments = await scanChunks(chunks, sessionId, setScanProgress);
      setScanSegments(segments);
      setStage('input');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed');
      setStage('input');
    }
  }

  // ── Submit actual tracks ──
  async function handleSubmit(actualTracks: ActualTrack[]) {
    setStage('reflecting');
    try {
      const res = await fetch(`/api/gigs/${id}/reflect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualTracks }),
      });
      const data = await res.json() as { reflection?: ReflectionData; plannedTracks?: PlannedTrack[]; error?: string };
      if (!res.ok || !data.reflection) throw new Error(data.error ?? 'Reflection failed');
      if (data.plannedTracks?.length) setPlannedTracks(data.plannedTracks);
      setReflection(data.reflection);
      setStage('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reflection failed');
      setStage('error');
    }
  }

  function submitFromScan() {
    const tracks: ActualTrack[] = scanSegments.map((s, i) => ({
      position: i + 1,
      artist: s.artist,
      title: s.title,
      timestamp: s.timestamp,
      source: 'scan' as const,
    }));
    handleSubmit(tracks);
  }

  function submitFromManual() {
    const filled = manualRows.filter(r => r.artist.trim() || r.title.trim());
    const tracks: ActualTrack[] = filled.map((r, i) => ({
      position: i + 1,
      artist: r.artist.trim(),
      title: r.title.trim(),
      source: 'manual' as const,
    }));
    if (!tracks.length) return;
    handleSubmit(tracks);
  }

  // ── Render ──

  if (stage === 'loading') return (
    <>
      <Nav />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        <LoadingState message="Loading gig..." />
      </div>
    </>
  );

  if (stage === 'error') return (
    <>
      <Nav />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        <EmptyState icon="⚠" title="Couldn't load gig" body={error ?? 'Unknown error'}
          cta={<SDButton onClick={() => router.push('/dashboard')}>Back to Dashboard</SDButton>} />
      </div>
    </>
  );

  if (stage === 'scanning') return (
    <>
      <Nav />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        <LoadingState spinner message={
          scanProgress
            ? `Scanning ${scanFile?.name ?? 'recording'} — ${scanProgress.done}/${scanProgress.total} chunks (${formatTimestamp(scanProgress.currentTimestamp)})`
            : 'Preparing recording...'
        } />
      </div>
    </>
  );

  if (stage === 'reflecting') return (
    <>
      <Nav />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        <LoadingState spinner message="Comparing planned vs actual set..." />
      </div>
    </>
  );

  const gigLabel = gig?.gigName ?? 'Gig';
  const dateLabel = gig?.gigDate
    ? new Date(gig.gigDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 24px 80px' }}>
        <PageHeader
          eyebrow={dateLabel + (gig?.venue ? ` · ${gig.venue}` : '')}
          title={gigLabel.toUpperCase()}
          subtitle={gig?.setlistName ? `Planned set: ${gig.setlistName}` : undefined}
          actions={
            <SDButton ghost onClick={() => router.push('/dashboard')} style={{ fontSize: 12, padding: '5px 12px' }}>
              ← Dashboard
            </SDButton>
          }
        />

        {/* ── Input stage ── */}
        {stage === 'input' && (
          <div style={{ marginTop: 24 }}>
            <Tabs
              tabs={[
                { id: 'recording', label: 'From Recording' },
                { id: 'manual', label: 'Log Manually' },
              ]}
              value={inputMode}
              onChange={v => setInputMode(v as InputMode)}
            />

            {inputMode === 'recording' && (
              <div style={{ marginTop: 20 }}>
                {scanSegments.length === 0 ? (
                  <Card padding="32px 24px" style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: SD.mono, fontSize: SD.t12, color: SD.textSec, marginBottom: 20 }}>
                      Upload your gig recording — SetDrop scans it every 45 seconds to identify tracks.
                    </div>
                    {scanError && (
                      <div style={{ fontFamily: SD.mono, fontSize: SD.t12, color: SD.danger, marginBottom: 16 }}>{scanError}</div>
                    )}
                    <SDButton onClick={() => fileRef.current?.click()}>
                      {scanFile ? 'Choose Different File' : 'Upload Recording'}
                    </SDButton>
                    <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileChange} />
                  </Card>
                ) : (
                  <Card padding="20px 24px">
                    <CardHeader title={`${scanSegments.length} tracks identified`} />
                    <div style={{ marginTop: 12 }}>
                      {scanSegments.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                          borderBottom: i < scanSegments.length - 1 ? `1px solid ${SD.border}` : 'none' }}>
                          <span style={{ fontFamily: SD.mono, fontSize: SD.t11, color: SD.textMuted, width: 36, flexShrink: 0 }}>
                            {formatTimestamp(s.timestamp)}
                          </span>
                          <span style={{ fontFamily: SD.mono, fontSize: SD.t12, color: SD.text, flex: 1, minWidth: 0,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.artist} — {s.title}
                          </span>
                          <span style={{ fontFamily: SD.mono, fontSize: SD.t10, color: s.confidence > 80 ? SD.success : SD.warning }}>
                            {Math.round(s.confidence)}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
                      <SDButton onClick={submitFromScan}>Generate Reflection</SDButton>
                      <SDButton ghost onClick={() => { setScanSegments([]); setScanFile(null); }}>Re-scan</SDButton>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {inputMode === 'manual' && (
              <div style={{ marginTop: 20 }}>
                <Card padding="20px 24px">
                  <CardHeader title="What did you actually play?" />
                  <div style={{ fontFamily: SD.mono, fontSize: SD.t11, color: SD.textMuted, marginBottom: 16, marginTop: 8 }}>
                    Fill in what you remember — skip rows you're unsure about.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 8, marginBottom: 12,
                    fontFamily: SD.mono, fontSize: SD.t10, color: SD.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>
                    <span>#</span><span>Artist</span><span>Title</span>
                  </div>
                  {manualRows.map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontFamily: SD.mono, fontSize: SD.t11, color: SD.textMuted, paddingTop: 8 }}>{i + 1}</span>
                      <input
                        value={row.artist}
                        onChange={e => setManualRows(prev => prev.map((r, j) => j === i ? { ...r, artist: e.target.value } : r))}
                        placeholder="Artist"
                        style={{ background: SD.surface2, border: `1px solid ${SD.border}`, borderRadius: SD.r2,
                          padding: '7px 10px', fontFamily: SD.mono, fontSize: SD.t12, color: SD.text, outline: 'none' }}
                      />
                      <input
                        value={row.title}
                        onChange={e => setManualRows(prev => prev.map((r, j) => j === i ? { ...r, title: e.target.value } : r))}
                        placeholder="Title"
                        style={{ background: SD.surface2, border: `1px solid ${SD.border}`, borderRadius: SD.r2,
                          padding: '7px 10px', fontFamily: SD.mono, fontSize: SD.t12, color: SD.text, outline: 'none' }}
                      />
                    </div>
                  ))}
                  <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <SDButton onClick={submitFromManual}>Generate Reflection</SDButton>
                    <SDButton ghost onClick={() =>
                      setManualRows(prev => [...prev, { artist: '', title: '' }])
                    } style={{ fontSize: 12, padding: '5px 12px' }}>
                      + Add Row
                    </SDButton>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── Results stage ── */}
        {stage === 'results' && reflection && (
          <div style={{ marginTop: 24 }}>

            {/* Stats strip */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Matched', value: reflection.matchCount, color: SD.success },
                { label: 'Swapped', value: reflection.swapCount, color: SD.warning },
                { label: 'Skipped', value: reflection.skippedCount, color: SD.danger },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, minWidth: 100, background: SD.surface, border: `1px solid ${SD.border}`,
                  borderRadius: SD.r3, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: SD.mono, fontSize: SD.t28, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontFamily: SD.mono, fontSize: SD.t10, color: SD.textMuted, letterSpacing: 1,
                    textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Energy arc */}
            {plannedTracks.length >= 2 && reflection.diff.length >= 2 && (
              <Card padding="20px 24px" style={{ marginBottom: 16 }}>
                <CardHeader title="Energy Arc" />
                <div style={{ marginTop: 16 }}>
                  <EnergyArcComparison planned={plannedTracks} diff={reflection.diff} />
                </div>
                <div style={{ fontFamily: SD.mono, fontSize: SD.t12, color: SD.textSec, marginTop: 12 }}>
                  {reflection.energySummary}
                </div>
              </Card>
            )}

            {/* Patterns */}
            {reflection.patterns.length > 0 && (
              <Card padding="20px 24px" style={{ marginBottom: 16 }}>
                <CardHeader title="Observations" />
                <div style={{ marginTop: 12 }}>
                  {reflection.patterns.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0',
                      borderBottom: i < reflection.patterns.length - 1 ? `1px solid ${SD.border}` : 'none' }}>
                      <span style={{ color: SD.accent, flexShrink: 0, marginTop: 1 }}>—</span>
                      <span style={{ fontFamily: SD.mono, fontSize: SD.t12, color: SD.textSec }}>{p}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Track diff */}
            <Card padding="20px 24px">
              <CardHeader title="Track-by-Track" />
              <div style={{ marginTop: 12 }}>
                {reflection.diff.map((d, i) => (
                  <div key={i} style={{ padding: '12px 0',
                    borderBottom: i < reflection.diff.length - 1 ? `1px solid ${SD.border}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontFamily: SD.mono, fontSize: SD.t11, color: SD.textMuted,
                        width: 24, flexShrink: 0, paddingTop: 2 }}>{d.position}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {d.planned && (
                          <div style={{ fontFamily: SD.mono, fontSize: SD.t12,
                            color: d.status === 'matched' ? SD.text : SD.textMuted,
                            textDecoration: d.status === 'skipped' ? 'line-through' : 'none',
                            marginBottom: d.actual && d.status !== 'matched' ? 4 : 0 }}>
                            {d.planned.artist} — {d.planned.title}
                          </div>
                        )}
                        {d.actual && d.status !== 'matched' && (
                          <div style={{ fontFamily: SD.mono, fontSize: SD.t12, color: SD.text }}>
                            {d.actual.artist} — {d.actual.title}
                          </div>
                        )}
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <StatusPill status={d.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <SDButton ghost onClick={() => { setStage('input'); setReflection(null); setScanSegments([]); }}
                style={{ fontSize: 12, padding: '6px 14px' }}>
                Re-submit actual tracks
              </SDButton>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
