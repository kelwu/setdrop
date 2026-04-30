'use client';

import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { SD, PageId } from '@/lib/setdrop/constants';
import { GeneratedSetlist } from '@/lib/agents/types';
import { Nav } from './shared';
import { LandingPage } from './LandingPage';
import { Dashboard } from './Dashboard';
import { SetlistBuilder } from './SetlistBuilder';
import { SetlistOutput } from './SetlistOutput';
import { Library } from './Library';
import { PublicShare } from './PublicShare';
import { SetlistHistory } from './SetlistHistory';

const PROTECTED_PAGES: PageId[] = ['dashboard', 'builder', 'output', 'library', 'history'];

export function SetDropApp() {
  const [page, setPage] = useState<PageId>('landing');
  const [generatedSetlist, setGeneratedSetlist] = useState<GeneratedSetlist | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setAuthLoading(false);
      if (user) {
        supabase.from('users').upsert({ id: user.id, email: user.email }, { onConflict: 'id' });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authLoading) return;

    // Handle post-login redirect
    const params = new URLSearchParams(window.location.search);
    const goto = params.get('goto') as PageId | null;
    if (goto && user) {
      navigate(goto);
      window.history.replaceState({}, '', '/');
      return;
    }

    // Restore last page from storage if authenticated
    const saved = localStorage.getItem('sd_page') as PageId | null;
    if (saved) setPage(saved);
  }, [authLoading, user]);

  const navigate = (p: string) => {
    const targetPage = p as PageId;
    if (PROTECTED_PAGES.includes(targetPage) && !user) {
      router.push('/login');
      return;
    }
    setPage(targetPage);
    localStorage.setItem('sd_page', p);
    window.scrollTo({ top: 0 });
  };

  const showNav = page !== 'landing' && page !== 'share';

  if (authLoading) {
    return (
      <div style={{
        background: SD.bg, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: SD.mono, fontSize: 11, color: SD.textMuted, letterSpacing: 2 }}>
          LOADING...
        </span>
      </div>
    );
  }

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
        @media (max-width: 768px) {
          .sd-decorative { display: none !important; }
          .sd-grid-3 { grid-template-columns: 1fr !important; }
          .sd-grid-2 { grid-template-columns: 1fr !important; }
          .sd-grid-5 { grid-template-columns: repeat(3, 1fr) !important; }
          .sd-nav-links { display: none !important; }
          .sd-landing-login { display: none !important; }
          .sd-pad-x { padding-left: 20px !important; padding-right: 20px !important; }
          .sd-landing-nav { padding-left: 20px !important; padding-right: 20px !important; }
          .sd-hero-pad { padding: 100px 20px 60px !important; }
          .sd-inner-pad { padding: 32px 20px !important; }
          .sd-arc-wrap { overflow-x: auto; }
        }
      `}</style>
      {showNav && <Nav page={page} setPage={navigate} user={user} />}
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
      {page === 'history'   && (
        <SetlistHistory
          setPage={navigate}
          onLoad={(s) => { setGeneratedSetlist(s); navigate('output'); }}
        />
      )}
    </div>
  );
}
