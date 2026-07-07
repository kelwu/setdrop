'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { SD } from '@/lib/setdrop/constants';
import { BRAND } from '@/lib/brand';
import { isMessageBlocked } from '@/lib/setdrop/knowledge';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant';
interface Message { id: number; role: Role; text: string; streaming?: boolean }

const STARTERS = [
  'What is SetLab?',
  'How do I import my library?',
  'What\'s the pricing?',
  'How does Track ID work?',
];

const BLOCKED_REPLY =
  "Let's keep it on topic — I can only help with SetLab questions. What would you like to know about the app?";

// ─── Component ────────────────────────────────────────────────────────────────

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [startersVisible, setStartersVisible] = useState(true);
  const pathname = usePathname();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  let nextId = useRef(0);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  function newId() { return ++nextId.current; }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setInput('');
    setStartersVisible(false);
    setBusy(true);

    const userMsg: Message = { id: newId(), role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);

    // Client-side guardrail
    if (isMessageBlocked(trimmed)) {
      setMessages(prev => [...prev, { id: newId(), role: 'assistant', text: BLOCKED_REPLY }]);
      setBusy(false);
      return;
    }

    // Placeholder for streaming response
    const assistantId = newId();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', text: '', streaming: true }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, page: pathname }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }

      // Check for blocked JSON response (server-side guard triggered)
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, text: json.blocked ? BLOCKED_REPLY : 'Something went wrong. Please try again.', streaming: false }
            : m
        ));
        setBusy(false);
        return;
      }

      // Stream plain text
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, text: current } : m
        ));
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, streaming: false } : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, text: 'Something went wrong. Please try again.', streaming: false }
          : m
      ));
    } finally {
      setBusy(false);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 999,
          width: 340, display: 'flex', flexDirection: 'column',
          background: SD.surface, border: `1px solid ${SD.borderMid}`,
          borderRadius: SD.r4, overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          maxHeight: 'calc(100vh - 120px)',
        }}>
          {/* Header */}
          <div style={{
            padding: `${SD.s4}px ${SD.s5}px`,
            borderBottom: `1px solid ${SD.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: SD.surface2, flexShrink: 0,
          }}>
            <div>
              <div style={{ fontFamily: SD.display, fontSize: SD.t16, letterSpacing: 2, color: SD.text }}>
                {BRAND.logoLeft}<span style={{ color: SD.accent }}>{BRAND.logoRight}</span>
                <span style={{ fontFamily: SD.mono, fontSize: SD.t10, color: SD.textMuted, marginLeft: SD.s2, letterSpacing: 1 }}>
                  ASSISTANT
                </span>
              </div>
              <div style={{ fontFamily: SD.mono, fontSize: SD.t10, color: SD.textMuted, marginTop: 2 }}>
                Ask me anything about the app
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: SD.textMuted, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: SD.s4, display: 'flex', flexDirection: 'column', gap: SD.s3, minHeight: 200 }}>
            {/* Welcome */}
            {!hasMessages && (
              <div style={{
                background: SD.surface2, border: `1px solid ${SD.border}`,
                borderRadius: SD.r3, padding: SD.s4,
                fontFamily: SD.mono, fontSize: SD.t12, color: SD.textSec, lineHeight: 1.6,
              }}>
                Hey! I know everything about SetLab — features, pricing, how-tos. What do you want to know?
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '82%',
                  padding: `${SD.s3}px ${SD.s4}px`,
                  borderRadius: SD.r3,
                  fontFamily: SD.mono, fontSize: SD.t12, lineHeight: 1.6,
                  ...(msg.role === 'user'
                    ? { background: SD.accentDim, border: `1px solid ${SD.accent}44`, color: SD.text }
                    : { background: SD.surface2, border: `1px solid ${SD.border}`, color: SD.textSec }
                  ),
                }}>
                  {msg.text || (msg.streaming && (
                    <span style={{ color: SD.textMuted }}>▋</span>
                  ))}
                  {msg.streaming && msg.text && (
                    <span style={{ color: SD.textMuted }}>▋</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Starter questions */}
          {startersVisible && !hasMessages && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: SD.s2,
              padding: `0 ${SD.s4}px ${SD.s3}px`,
              borderTop: `1px solid ${SD.border}`, paddingTop: SD.s3,
              flexShrink: 0,
            }}>
              {STARTERS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{
                    background: SD.surface3, border: `1px solid ${SD.border}`,
                    borderRadius: SD.r2, padding: `${SD.s2}px ${SD.s3}px`,
                    fontFamily: SD.mono, fontSize: SD.t11, color: SD.textSec,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLButtonElement).style.borderColor = SD.borderMid;
                    (e.target as HTMLButtonElement).style.color = SD.text;
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLButtonElement).style.borderColor = SD.border;
                    (e.target as HTMLButtonElement).style.color = SD.textSec;
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            display: 'flex', gap: SD.s2,
            padding: `${SD.s3}px ${SD.s4}px ${SD.s4}px`,
            borderTop: `1px solid ${SD.border}`,
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder="Ask a question..."
              disabled={busy}
              style={{
                flex: 1, background: SD.surface2, border: `1px solid ${SD.border}`,
                borderRadius: SD.r3, color: SD.text, fontFamily: SD.mono,
                fontSize: SD.t12, padding: `${SD.s2}px ${SD.s3}px`,
                outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = SD.borderMid)}
              onBlur={e => (e.target.style.borderColor = SD.border)}
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              style={{
                background: input.trim() && !busy ? SD.accent : SD.surface3,
                color: input.trim() && !busy ? '#000' : SD.textMuted,
                border: 'none', borderRadius: SD.r3, cursor: input.trim() && !busy ? 'pointer' : 'default',
                fontFamily: SD.mono, fontSize: SD.t12, fontWeight: 600,
                padding: `${SD.s2}px ${SD.s4}px`,
                transition: 'background 0.15s, color 0.15s',
                minWidth: 40,
              }}
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        title={open ? 'Close' : 'Ask SetLab anything'}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? SD.surface3 : SD.accent,
          border: `1px solid ${open ? SD.borderMid : 'transparent'}`,
          color: open ? SD.textMuted : '#000',
          cursor: 'pointer', fontSize: open ? 22 : 20, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          transition: 'background 0.2s, color 0.2s',
        }}
      >
        {open ? '×' : '💬'}
      </button>
    </>
  );
}
