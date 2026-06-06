'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SD } from '@/lib/setdrop/constants';
import { SDButton, PageHeader, Card, EmptyState } from '@/components/setdrop/shared';
import type { AcrCloudMatch } from '@/lib/setdrop/acrcloud';

type Stage = 'idle' | 'recording' | 'processing' | 'result' | 'no-match' | 'quota';

interface IdResult {
  requestId: string | null;
  matched: boolean;
  candidates: AcrCloudMatch[];
  alreadyInLibrary: boolean;
  alreadyInWishlist: boolean;
  quotaRemaining: number;
  quotaLimit: number;
}

const MAX_RECORD_S = 15;
const MIN_RECORD_S = 5;

export default function TrackIdPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<IdResult | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<{ limit: number; resetsAt: string } | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auth guard
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login');
    });
  }, [router]);

  // Auto-stop at MAX_RECORD_S
  useEffect(() => {
    if (stage === 'recording') {
      timerRef.current = setInterval(() => {
        setElapsed(e => {
          const next = e + 1;
          if (next >= MAX_RECORD_S) stopRecording();
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); };
      mediaRef.current = recorder;
      recorder.start(100);
      setStage('recording');
    } catch {
      setError('Microphone access denied. Allow microphone permission and try again.');
    }
  }

  function stopRecording() {
    const recorder = mediaRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      await identify(blob, 'mic');
    };
    recorder.stop();
    setStage('processing');
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('File too large (max 10MB)'); return; }
    setError(null);
    setStage('processing');
    await identify(file, 'upload');
    e.target.value = '';
  }

  async function identify(audio: Blob | File, source: 'mic' | 'upload') {
    setStage('processing');
    setSaved(false);
    setSaveError(null);
    try {
      const form = new FormData();
      form.append('audio', audio, 'audio.webm');
      form.append('source', source);

      const res = await fetch('/api/track-id', { method: 'POST', body: form });
      const data = await res.json() as IdResult & { error?: string; limit?: number; resetsAt?: string };

      if (res.status === 429) {
        setQuotaInfo({ limit: data.limit ?? 10, resetsAt: data.resetsAt ?? '' });
        setStage('quota');
        return;
      }
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

      setResult(data);
      setSelectedIdx(0);
      setStage(data.matched ? 'result' : 'no-match');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to identify track');
      setStage('idle');
    }
  }

  async function saveToWishlist() {
    if (!result || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/track-id/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: result.requestId, candidate: result.candidates[selectedIdx] }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Save failed');
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setStage('idle');
    setResult(null);
    setError(null);
    setSaved(false);
    setSaveError(null);
    setElapsed(0);
  }

  const canStop = elapsed >= MIN_RECORD_S;
  const topMatch = result?.candidates[selectedIdx];

  return (
    <div style={{ background: SD.bg, minHeight: '100vh', paddingTop: 56, color: SD.text }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 24px' }}>

        <PageHeader
          size="medium"
          eyebrow="Track ID"
          title="ID A TRACK"
          subtitle="Hold your phone near a speaker. We'll identify it in seconds."
        />

        {/* ── Idle ── */}
        {stage === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && (
              <div style={{ fontFamily: SD.mono, fontSize: 12, color: SD.danger,
                background: SD.dangerDim, border: `1px solid ${SD.danger}33`,
                borderRadius: SD.r2, padding: '10px 14px', marginBottom: 4 }}>
                {error}
              </div>
            )}
            <button
              onClick={startRecording}
              style={{
                width: '100%', padding: '28px 24px', cursor: 'pointer',
                background: SD.surface, border: `1px solid ${SD.borderMid}`,
                borderRadius: 4, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 12, transition: 'border-color .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = SD.accent)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = SD.borderMid)}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke={SD.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              <div>
                <div style={{ fontFamily: SD.mono, fontSize: 14, fontWeight: 600, color: SD.text }}>
                  Tap to Record
                </div>
                <div style={{ fontFamily: SD.mono, fontSize: 11, color: SD.textMuted, marginTop: 4 }}>
                  Hold up to the speaker · 5 – 15 seconds
                </div>
              </div>
            </button>

            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%', padding: '16px 24px', cursor: 'pointer',
                background: 'transparent', border: `1px solid ${SD.border}`,
                borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, transition: 'border-color .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = SD.borderMid)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = SD.border)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={SD.textSec} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span style={{ fontFamily: SD.mono, fontSize: 13, color: SD.textSec }}>Upload audio file</span>
            </button>
            <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileUpload} />
          </div>
        )}

        {/* ── Recording ── */}
        {stage === 'recording' && (
          <Card
            padding="40px 24px"
            style={{ border: `1px solid ${SD.accent}44`, textAlign: 'center' }}
          >
            {/* Waveform animation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 4, height: 40, marginBottom: 24 }}>
              {[1, 0.6, 0.9, 0.5, 0.8, 0.4, 0.7, 0.5, 0.9, 0.6, 1].map((h, i) => (
                <div key={i} style={{
                  width: 3, borderRadius: 2, background: SD.accent,
                  animation: `sdWave ${0.6 + i * 0.07}s ease-in-out infinite alternate`,
                  height: `${h * 36}px`,
                  opacity: 0.6 + h * 0.4,
                }} />
              ))}
            </div>
            <div style={{ fontFamily: SD.display, fontSize: 40, letterSpacing: 2,
              color: SD.text, marginBottom: 4 }}>
              {elapsed}s
            </div>
            <div style={{ fontFamily: SD.mono, fontSize: 11, color: SD.textMuted,
              marginBottom: 28, letterSpacing: 1.5 }}>
              {elapsed < MIN_RECORD_S
                ? `HOLD STEADY · ${MIN_RECORD_S - elapsed}s UNTIL STOP`
                : `LISTENING · TAP TO STOP`}
            </div>
            <SDButton
              onClick={stopRecording}
              disabled={!canStop}
              style={{ opacity: canStop ? 1 : 0.4 }}
            >
              {canStop ? 'Stop & Identify' : `Wait ${MIN_RECORD_S - elapsed}s...`}
            </SDButton>
          </Card>
        )}

        {/* ── Processing ── */}
        {stage === 'processing' && (
          <Card padding="60px 24px" style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32,
              border: `2px solid ${SD.border}`, borderTopColor: SD.accent,
              borderRadius: '50%', animation: 'sdSpin 0.8s linear infinite',
              marginBottom: 20 }} />
            <div style={{ fontFamily: SD.mono, fontSize: 13, color: SD.textSec }}>
              Identifying...
            </div>
            <div style={{ fontFamily: SD.mono, fontSize: 11, color: SD.textMuted, marginTop: 8 }}>
              Usually 2 – 5 seconds
            </div>
          </Card>
        )}

        {/* ── Result: Match ── */}
        {stage === 'result' && topMatch && (
          <div>
            <div style={{ fontFamily: SD.mono, fontSize: 11, color: SD.success,
              letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
              ✓ Match found
            </div>

            {/* Candidate selector */}
            {(result?.candidates.length ?? 0) > 1 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {result!.candidates.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIdx(i)}
                    style={{
                      fontFamily: SD.mono, fontSize: 11, padding: '4px 10px',
                      borderRadius: 2, cursor: 'pointer',
                      background: i === selectedIdx ? SD.accentDim : 'transparent',
                      border: `1px solid ${i === selectedIdx ? SD.accent + '66' : SD.border}`,
                      color: i === selectedIdx ? SD.accent : SD.textMuted,
                    }}
                  >
                    {i === 0 ? 'Best match' : `Alt ${i}`} · {c.confidence}%
                  </button>
                ))}
              </div>
            )}

            {/* Match card */}
            <Card padding="20px" style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: SD.mono, fontSize: 16, fontWeight: 600,
                color: SD.text, marginBottom: 4 }}>
                {topMatch.title}
              </div>
              <div style={{ fontFamily: SD.mono, fontSize: 13, color: SD.textSec, marginBottom: 12 }}>
                {topMatch.artist}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {topMatch.bpm && (
                  <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.accent }}>
                    {topMatch.bpm} BPM
                  </span>
                )}
                {topMatch.genre && (
                  <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textSec }}>
                    {topMatch.genre}
                  </span>
                )}
                {topMatch.releaseDate && (
                  <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted }}>
                    {topMatch.releaseDate.slice(0, 4)}
                  </span>
                )}
                {topMatch.confidence > 0 && (
                  <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted }}>
                    {topMatch.confidence}% confidence
                  </span>
                )}
              </div>

              {/* Library / wishlist dedup */}
              {result?.alreadyInLibrary && (
                <div style={{ marginTop: 12, fontFamily: SD.mono, fontSize: 12,
                  color: SD.success, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%',
                    background: SD.success, display: 'inline-block' }} />
                  Already in your library
                </div>
              )}
              {result?.alreadyInWishlist && !result?.alreadyInLibrary && (
                <div style={{ marginTop: 12, fontFamily: SD.mono, fontSize: 12,
                  color: SD.accent, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%',
                    background: SD.accent, display: 'inline-block' }} />
                  Already in your wishlist
                </div>
              )}
            </Card>

            {saveError && (
              <div style={{ fontFamily: SD.mono, fontSize: 12, color: SD.danger, marginBottom: 12 }}>
                {saveError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <SDButton
                onClick={saveToWishlist}
                disabled={saved || saving}
                style={{ flex: 1, opacity: saved ? 0.7 : 1 }}
              >
                {saved ? '✓ Added to Wishlist' : saving ? 'Saving...' : '+ Wishlist'}
              </SDButton>
              <a
                href={topMatch.beatportSearchUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: SD.mono, fontSize: 12, color: SD.textSec,
                  background: SD.surface, border: `1px solid ${SD.border}`,
                  borderRadius: 3, padding: '10px 14px', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
                }}
              >
                Beatport ↗
              </a>
            </div>

            {result && (
              <div style={{ fontFamily: SD.mono, fontSize: 11, color: SD.textMuted,
                marginTop: 20, textAlign: 'center' }}>
                {result.quotaRemaining} ID{result.quotaRemaining !== 1 ? 's' : ''} remaining this month ·{' '}
                <span onClick={reset} style={{ color: SD.accent, cursor: 'pointer' }}>ID another</span>
              </div>
            )}
          </div>
        )}

        {/* ── No Match ── */}
        {stage === 'no-match' && (
          <Card padding="20px 24px">
            <EmptyState
              title="No match found"
              body="Probably an unreleased track, promo, or dub."
              cta={
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <SDButton onClick={reset}>Try Again</SDButton>
                  <SDButton ghost onClick={() => router.push('/library')}>Add Manually</SDButton>
                </div>
              }
            />
          </Card>
        )}

        {/* ── Quota Exhausted ── */}
        {stage === 'quota' && (
          <Card padding="20px 24px">
            <EmptyState
              title="Out of free IDs this month"
              body={
                `You've used your ${quotaInfo?.limit ?? 10} free IDs.` +
                (quotaInfo?.resetsAt
                  ? ` Resets ${new Date(quotaInfo.resetsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`
                  : '')
              }
              cta={<SDButton onClick={() => router.push('/account')}>Upgrade to Pro — $12/mo</SDButton>}
            />
          </Card>
        )}

      </div>

      <style>{`
        @keyframes sdWave {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
