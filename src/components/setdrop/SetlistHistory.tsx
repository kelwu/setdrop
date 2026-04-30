'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SD } from '@/lib/setdrop/constants';
import { GeneratedSetlist, SetlistTrack } from '@/lib/agents/types';
import { SDButton } from './shared';

interface DbSetlist {
  id: string;
  name: string;
  primary_genre: string | null;
  secondary_genre: string | null;
  duration_minutes: number | null;
  crowd_context: string | null;
  lineup_slot: string | null;
  is_public: boolean;
  share_url: string | null;
  created_at: string;
  tracks_json: unknown;
}

function trackCount(row: DbSetlist): number {
  return Array.isArray(row.tracks_json) ? (row.tracks_json as unknown[]).length : 0;
}

function genre(row: DbSetlist): string {
  return [row.primary_genre, row.secondary_genre].filter(Boolean).join(' / ') || '—';
}

function dbToSetlist(row: DbSetlist): GeneratedSetlist {
  return {
    name: row.name,
    tracks: Array.isArray(row.tracks_json) ? (row.tracks_json as SetlistTrack[]) : [],
    reviewNotes: '',
    shareSlug: row.share_url || '',
    dbId: row.id,
    dbSlug: row.share_url || undefined,
  };
}

function groupByMonth(sets: DbSetlist[]): { label: string; items: DbSetlist[] }[] {
  const map = new Map<string, DbSetlist[]>();
  for (const s of sets) {
    const label = new Date(s.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(s);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export function SetlistHistory({
  setPage,
  onLoad,
}: {
  setPage: (p: string) => void;
  onLoad: (setlist: GeneratedSetlist) => void;
}) {
  const [sets, setSets] = useState<DbSetlist[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('setlists')
        .select('id, name, primary_genre, secondary_genre, duration_minutes, crowd_context, lineup_slot, is_public, share_url, created_at, tracks_json')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setSets(data as DbSetlist[] ?? []);
    });
  }, []);

  const handleLoad = (row: DbSetlist) => {
    setLoadingId(row.id);
    onLoad(dbToSetlist(row));
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from('setlists').delete().eq('id', id);
    setSets(prev => prev?.filter(s => s.id !== id) ?? []);
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const groups = sets ? groupByMonth(sets) : [];

  return (
    <div style={{ background: SD.bg, minHeight: '100vh', paddingTop: 56, color: SD.text }}>
      <div className="sd-pad-x sd-inner-pad" style={{ maxWidth: 900, margin: '0 auto', padding: '48px 40px' }}>

        <div style={{ marginBottom: 36, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: SD.mono, fontSize: 9, color: SD.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
              Set History
            </div>
            <h1 style={{ fontFamily: SD.display, fontSize: 52, letterSpacing: 4, margin: 0, color: SD.text, lineHeight: 1 }}>
              YOUR SETS
            </h1>
          </div>
          <SDButton onClick={() => setPage('builder')} style={{ fontSize: 13, padding: '13px 32px' }}>
            + Build New Set
          </SDButton>
        </div>

        {sets === null ? (
          <div style={{ padding: '80px 0', textAlign: 'center', fontFamily: SD.mono, fontSize: 11, color: SD.textMuted }}>
            Loading...
          </div>
        ) : sets.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: SD.display, fontSize: 48, letterSpacing: 3, color: SD.textMuted, marginBottom: 16 }}>
              NO SETS YET
            </div>
            <div style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted, marginBottom: 24 }}>
              Generate your first set to see it here.
            </div>
            <SDButton onClick={() => setPage('builder')}>Build Your First Set</SDButton>
          </div>
        ) : (
          groups.map(({ label, items }) => (
            <div key={label} style={{ marginBottom: 40 }}>
              <div style={{ fontFamily: SD.mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: SD.textMuted, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${SD.border}` }}>
                {label} · {items.length} set{items.length !== 1 ? 's' : ''}
              </div>
              {items.map(row => (
                <div key={row.id} style={{ marginBottom: 8 }}>
                  {confirmDeleteId === row.id ? (
                    <div style={{ padding: '16px 20px', background: 'rgba(220,50,50,0.06)', border: '1px solid rgba(220,50,50,0.25)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: SD.mono, fontSize: 11, color: SD.text, flex: 1 }}>Delete &ldquo;{row.name}&rdquo;?</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <SDButton onClick={() => handleDelete(row.id)}
                          style={{ fontSize: 10, background: 'rgba(220,50,50,0.15)', borderColor: 'rgba(220,50,50,0.4)', color: '#E05555', opacity: deletingId === row.id ? 0.6 : 1 }}>
                          {deletingId === row.id ? 'Deleting...' : 'Delete'}
                        </SDButton>
                        <SDButton ghost onClick={() => setConfirmDeleteId(null)} style={{ fontSize: 10 }}>Cancel</SDButton>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{ padding: '20px 24px', background: SD.surface, border: `1px solid ${SD.border}`, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', transition: 'border-color .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = SD.borderMid)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = SD.border)}
                    >
                      {/* Main info */}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontFamily: SD.mono, fontSize: 14, fontWeight: 600, color: SD.text, marginBottom: 6 }}>
                          {row.name}
                          {row.is_public && (
                            <span style={{ marginLeft: 10, fontFamily: SD.mono, fontSize: 9, color: SD.green, background: SD.greenDim, border: `1px solid ${SD.green}44`, borderRadius: 2, padding: '2px 6px', letterSpacing: 1, textTransform: 'uppercase' }}>
                              Public
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: SD.mono, fontSize: 10, color: SD.textSec }}>{genre(row)}</span>
                          {row.crowd_context && <span style={{ fontFamily: SD.mono, fontSize: 10, color: SD.textMuted }}>{row.crowd_context}</span>}
                          {row.lineup_slot && <span style={{ fontFamily: SD.mono, fontSize: 10, color: SD.textMuted }}>{row.lineup_slot}</span>}
                        </div>
                      </div>

                      {/* Meta */}
                      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: SD.mono, fontSize: 16, fontWeight: 600, color: SD.accent }}>{trackCount(row)}</div>
                          <div style={{ fontFamily: SD.mono, fontSize: 9, color: SD.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>tracks</div>
                        </div>
                        {row.duration_minutes && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: SD.mono, fontSize: 16, fontWeight: 600, color: SD.text }}>{row.duration_minutes}m</div>
                            <div style={{ fontFamily: SD.mono, fontSize: 9, color: SD.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>duration</div>
                          </div>
                        )}
                        <div style={{ fontFamily: SD.mono, fontSize: 10, color: SD.textMuted }}>
                          {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <SDButton onClick={() => handleLoad(row)} style={{ fontSize: 10, padding: '7px 18px', opacity: loadingId === row.id ? 0.6 : 1 }}>
                          {loadingId === row.id ? 'Loading...' : 'View Set →'}
                        </SDButton>
                        <SDButton ghost onClick={() => setConfirmDeleteId(row.id)} style={{ fontSize: 10, padding: '7px 12px', color: SD.textMuted }}>
                          ✕
                        </SDButton>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
