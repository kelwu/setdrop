'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SD } from '@/lib/setdrop/constants';

// Bump VERSION whenever the items below change — a user who has dismissed an older
// version will see the modal again for the new one (localStorage stores the last
// version seen). Keep items DJ-facing: the benefit, not the internals.
const VERSION = '2026-08';
const STORAGE_KEY = 'sd_whatsnew_seen';

const ITEMS: { title: string; desc: string }[] = [
  { title: 'Smarter set pacing', desc: 'Track counts now match how each genre is actually mixed — no more short, over-long sets.' },
  { title: 'Crates fill to your size', desc: 'Ask for 25 and get 25 — topped up from the wider genre family, with an honest exact-vs-filled split.' },
  { title: 'Sharper genre matching', desc: 'No more off-genre tracks slipping into your sets or crates.' },
  { title: 'Genre column in the Crate Builder', desc: 'See each track’s genre at a glance while you review a crate.' },
  { title: 'Build sets your way', desc: 'Define a set by genre, era, and/or artist — or straight from a Rekordbox playlist.' },
];

export function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== VERSION) setOpen(true);
    } catch { /* localStorage blocked — just don't show */ }
  }, []);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, VERSION); } catch { /* ignore */ }
    setOpen(false);
  }, []);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What's new in SetLab"
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, animation: 'sdFadeUp 0.25s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto',
          background: SD.surface, border: `1px solid ${SD.borderMid}`,
          borderTop: `2px solid ${SD.accent}`, borderRadius: SD.r3,
          padding: '28px 28px 24px', position: 'relative',
        }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            position: 'absolute', right: 14, top: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            color: SD.textMuted, fontSize: 18, lineHeight: 1, padding: 6,
          }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{
          fontFamily: SD.mono, fontSize: SD.t10, letterSpacing: 2,
          textTransform: 'uppercase', color: SD.accent, marginBottom: 8,
        }}>
          New in SetLab
        </div>
        <div style={{
          fontFamily: SD.display, fontSize: SD.t20, letterSpacing: 2,
          color: SD.text, marginBottom: 22,
        }}>
          WHAT&rsquo;S NEW
        </div>

        {/* Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 26 }}>
          {ITEMS.map(item => (
            <div key={item.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0, marginTop: 6, width: 6, height: 6, borderRadius: '50%',
                background: SD.accent,
              }} />
              <div>
                <div style={{
                  fontFamily: SD.mono, fontSize: SD.t12, color: SD.text,
                  fontWeight: 600, marginBottom: 3,
                }}>
                  {item.title}
                </div>
                <div style={{
                  fontFamily: SD.body, fontSize: SD.t12, color: SD.textSec, lineHeight: 1.6,
                }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          style={{
            width: '100%', fontFamily: SD.mono, fontSize: SD.t12, letterSpacing: 1.5,
            textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer',
            background: SD.accent, color: '#000', border: 'none',
            borderRadius: SD.r2, padding: '12px 20px',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
