'use client';

import React, { useState, useEffect } from 'react';
import { SD, PageId } from '@/lib/setdrop/constants';
import { GeneratedSetlist } from '@/lib/agents/types';
import { Nav } from './shared';
import { LandingPage } from './LandingPage';
import { Dashboard } from './Dashboard';
import { SetlistBuilder } from './SetlistBuilder';
import { SetlistOutput } from './SetlistOutput';
import { Library } from './Library';
import { PublicShare } from './PublicShare';

export function SetDropApp() {
  const [page, setPage] = useState<PageId>('landing');
  const [generatedSetlist, setGeneratedSetlist] = useState<GeneratedSetlist | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('sd_page') as PageId | null;
    if (saved) setPage(saved);
  }, []);

  const navigate = (p: string) => {
    setPage(p as PageId);
    localStorage.setItem('sd_page', p);
    window.scrollTo({ top: 0 });
  };

  const showNav = page !== 'landing' && page !== 'share';

  return (
    <div style={{ background:SD.bg, minHeight:'100vh' }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0A0A0A; }
        ::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #3A3A3A; }
        input, button, textarea { font-family: var(--font-mono), monospace; }
        input::placeholder { color: #4A4A4A; }
        @keyframes sdPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .5; transform: scale(1.3); }
        }
      `}</style>
      {showNav && <Nav page={page} setPage={navigate} />}
      {page === 'landing'   && <LandingPage setPage={navigate} />}
      {page === 'dashboard' && <Dashboard setPage={navigate} />}
      {page === 'builder'   && (
        <SetlistBuilder
          setPage={navigate}
          onSetlistGenerated={(s) => { setGeneratedSetlist(s); navigate('output'); }}
        />
      )}
      {page === 'output'    && <SetlistOutput setPage={navigate} setlist={generatedSetlist} />}
      {page === 'library'   && <Library setPage={navigate} />}
      {page === 'share'     && <PublicShare setPage={navigate} setlist={generatedSetlist} />}
    </div>
  );
}
