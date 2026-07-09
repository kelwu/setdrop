'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SD } from '@/lib/setdrop/constants';

interface Announcement {
  id: string;
  title: string;
  body: string | null;
  link_url: string | null;
  link_label: string | null;
}

const STORAGE_KEY = 'sd_dismissed_announcements';

function getDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function saveDismissed(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function AnnouncementBanner() {
  const [all, setAll] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDismissed(getDismissed());
    fetch('/api/announcements')
      .then(r => r.json())
      .then((d: { announcements?: Announcement[] }) => {
        setAll(d.announcements ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const visible = all.filter(a => !dismissed.includes(a.id));

  // Pages pad their content by the 56px nav height only. The banner is fixed
  // directly below the nav, so push all page content down by its height while
  // visible to avoid covering the top of the page. Reset when gone/unmounted.
  useEffect(() => {
    const h = visible.length && wrapRef.current ? wrapRef.current.offsetHeight : 0;
    document.body.style.paddingTop = h ? `${h}px` : '';
    return () => { document.body.style.paddingTop = ''; };
  }, [visible.length, loaded]);

  if (!loaded || !visible.length) return null;

  const handleDismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    saveDismissed(next);
  };

  return (
    <div ref={wrapRef} style={{ position: 'fixed', top: 56, left: 0, right: 0, zIndex: 199 }}>
      {visible.map(a => (
        <div key={a.id} style={{
          background: '#0F0D07',
          borderBottom: `1px solid ${SD.accent}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '9px 56px', minHeight: 42, position: 'relative',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{
              fontFamily: SD.mono, fontSize: SD.t10, letterSpacing: 2,
              textTransform: 'uppercase', color: SD.accent,
              background: `${SD.accent}18`, border: `1px solid ${SD.accent}44`,
              borderRadius: SD.r1, padding: '2px 7px', whiteSpace: 'nowrap',
            }}>
              New
            </span>
            <span style={{ fontFamily: SD.mono, fontSize: SD.t12, color: SD.text, fontWeight: 500 }}>
              {a.title}
            </span>
            {a.body && (
              <span style={{ fontFamily: SD.mono, fontSize: SD.t12, color: SD.textSec }}>
                {a.body}
              </span>
            )}
            {a.link_url && (
              <a
                href={a.link_url}
                style={{
                  fontFamily: SD.mono, fontSize: SD.t11, letterSpacing: 1.5,
                  textTransform: 'uppercase', color: SD.accent,
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                {a.link_label ?? 'Learn more'} →
              </a>
            )}
          </div>

          <button
            onClick={() => handleDismiss(a.id)}
            aria-label="Dismiss"
            style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: SD.textMuted, fontSize: 16, lineHeight: 1, padding: 6,
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
