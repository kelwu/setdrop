'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SD, GENRES } from '@/lib/setdrop/constants';
import { SDButton } from './shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExploreSet {
  id: string;
  name: string;
  primaryGenre: string | null;
  secondaryGenre: string | null;
  lineupSlot: string | null;
  durationMinutes: number | null;
  shareSlug: string;
  createdAt: string;
  trackCount: number;
  energyPoints: number[];
  likes: number;
  liked: boolean;
}

interface TrendingTrack {
  artist: string;
  title: string;
  count: number;
  genres: string[];
}

// ─── Mini Energy Sparkline ────────────────────────────────────────────────────

function EnergySparkline({ points }: { points: number[] }) {
  if (!points.length) return null;
  const w = 120, h = 28;
  const step = w / Math.max(points.length - 1, 1);
  const toY = (v: number) => h - (v / 10) * h;
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step},${toY(v)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={points.map((v, i) => `${i * step},${toY(v)}`).join(' ')}
        fill="none"
        stroke={SD.accent}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.7}
      />
      <path
        d={`${d} L${(points.length - 1) * step},${h} L0,${h} Z`}
        fill={SD.accent}
        opacity={0.08}
      />
    </svg>
  );
}

// ─── Set Card ─────────────────────────────────────────────────────────────────

function SetCard({ set, onLike }: { set: ExploreSet; onLike: (id: string) => void }) {
  const [hov, setHov] = useState(false);
  const age = Math.floor((Date.now() - new Date(set.createdAt).getTime()) / 86400000);
  const ageLabel = age === 0 ? 'Today' : age === 1 ? 'Yesterday' : `${age}d ago`;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? SD.surface2 : SD.surface,
        border: `1px solid ${hov ? SD.borderMid : SD.border}`,
        borderRadius: 4, padding: '20px 22px',
        display: 'flex', flexDirection: 'column', gap: 12,
        transition: 'all .15s', cursor: 'default',
      }}
    >
      {/* Genre + Slot badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {set.primaryGenre && (
          <span style={{
            fontFamily: SD.mono, fontSize: 11, letterSpacing: 1.2,
            textTransform: 'uppercase', padding: '3px 8px',
            background: SD.accentDim, color: SD.accent,
            border: `1px solid ${SD.accent}33`, borderRadius: 2,
          }}>{set.primaryGenre}</span>
        )}
        {set.lineupSlot && (
          <span style={{
            fontFamily: SD.mono, fontSize: 11, letterSpacing: 1.2,
            textTransform: 'uppercase', padding: '3px 8px',
            background: SD.surface3, color: SD.textSec,
            border: `1px solid ${SD.border}`, borderRadius: 2,
          }}>{set.lineupSlot}</span>
        )}
      </div>

      {/* Set name */}
      <div style={{ fontFamily: SD.display, fontSize: 20, letterSpacing: 2, color: SD.text, lineHeight: 1.2 }}>
        {set.name}
      </div>

      {/* Energy sparkline */}
      {set.energyPoints.length > 1 && (
        <EnergySparkline points={set.energyPoints} />
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted }}>
          {set.trackCount} tracks
        </span>
        {set.durationMinutes && (
          <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted }}>
            {set.durationMinutes} min
          </span>
        )}
        <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted, marginLeft: 'auto' }}>
          {ageLabel}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <button
          onClick={() => onLike(set.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: set.liked ? SD.accentDim : 'transparent',
            border: `1px solid ${set.liked ? SD.accent : SD.border}`,
            borderRadius: 3, padding: '5px 10px',
            color: set.liked ? SD.accent : SD.textMuted,
            fontFamily: SD.mono, fontSize: 12, cursor: 'pointer',
            transition: 'all .15s',
          }}
        >
          {set.liked ? '♥' : '♡'} {set.likes}
        </button>
        <a
          href={`/set/${set.shareSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: 'auto', fontFamily: SD.mono, fontSize: 12,
            letterSpacing: 1, textTransform: 'uppercase',
            color: SD.accent, textDecoration: 'none',
            opacity: hov ? 1 : 0.7, transition: 'opacity .15s',
          }}
        >
          View Set →
        </a>
      </div>
    </div>
  );
}

// ─── Trending Row ─────────────────────────────────────────────────────────────

function TrendingRow({ track, rank }: { track: TrendingTrack; rank: number }) {
  const barMax = 100;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '28px 1fr auto',
      gap: 12, alignItems: 'center',
      padding: '10px 0', borderBottom: `1px solid ${SD.border}`,
    }}>
      <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textMuted, textAlign: 'right' }}>
        {rank}
      </span>
      <div>
        <div style={{ fontFamily: SD.mono, fontSize: 13, color: SD.text, marginBottom: 4 }}>
          {track.artist} — <span style={{ color: SD.textSec }}>{track.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{
            height: 3, borderRadius: 2,
            background: SD.accent, opacity: 0.6,
            width: `${Math.min(100, (track.count / barMax) * 100)}%`,
            minWidth: 8, maxWidth: 120,
          }} />
          {track.genres.slice(0, 2).map(g => (
            <span key={g} style={{
              fontFamily: SD.mono, fontSize: 10, color: SD.textMuted,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>{g}</span>
          ))}
        </div>
      </div>
      <span style={{ fontFamily: SD.mono, fontSize: 12, color: SD.textSec, whiteSpace: 'nowrap' }}>
        {track.count} {track.count === 1 ? 'set' : 'sets'}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Explore() {
  const [sets, setSets] = useState<ExploreSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const [trending, setTrending] = useState<TrendingTrack[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingWindow, setTrendingWindow] = useState<'week' | 'month' | 'all'>('month');

  const [genreFilter, setGenreFilter] = useState('');
  const [slotFilter, setSlotFilter] = useState('');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');

  const SLOTS = ['Opener', 'Middle', 'Headliner', 'Closing'];

  const loadSets = useCallback(async (newPage: number, append: boolean) => {
    setSetsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(newPage),
        sort,
        ...(genreFilter ? { genre: genreFilter } : {}),
        ...(slotFilter ? { slot: slotFilter } : {}),
      });
      const res = await fetch(`/api/explore/sets?${params}`);
      const data = await res.json() as { sets?: ExploreSet[]; hasMore?: boolean; error?: string };
      if (data.error) throw new Error(data.error);
      setSets(prev => append ? [...prev, ...(data.sets ?? [])] : (data.sets ?? []));
      setHasMore(data.hasMore ?? false);
    } catch { /* silent */ } finally {
      setSetsLoading(false);
    }
  }, [genreFilter, slotFilter, sort]);

  const loadTrending = useCallback(async () => {
    setTrendingLoading(true);
    try {
      const res = await fetch(`/api/explore/trending?window=${trendingWindow}`);
      const data = await res.json() as { trending?: TrendingTrack[]; error?: string };
      setTrending(data.trending ?? []);
    } catch { /* silent */ } finally {
      setTrendingLoading(false);
    }
  }, [trendingWindow]);

  useEffect(() => { setPage(0); loadSets(0, false); }, [loadSets]);
  useEffect(() => { loadTrending(); }, [loadTrending]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadSets(next, true);
  };

  const handleLike = async (setlistId: string) => {
    const res = await fetch('/api/explore/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setlistId }),
    });
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json() as { liked?: boolean; count?: number };
    setSets(prev => prev.map(s =>
      s.id === setlistId ? { ...s, liked: data.liked ?? s.liked, likes: data.count ?? s.likes } : s
    ));
  };

  return (
    <div style={{ background: SD.bg, minHeight: '100vh', paddingTop: 56, color: SD.text }}>
      <div className="sd-pad-x sd-inner-pad" style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: SD.mono, fontSize: 13, color: SD.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Community
          </div>
          <h1 style={{ fontFamily: SD.display, fontSize: 52, letterSpacing: 4, margin: 0, color: SD.text, lineHeight: 1 }}>
            DISCOVER
          </h1>
        </div>

        {/* ── Trending Tracks ── */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: SD.mono, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: SD.textMuted }}>
              Trending Tracks
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['week', 'month', 'all'] as const).map(w => (
                <button key={w} onClick={() => setTrendingWindow(w)} style={{
                  fontFamily: SD.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
                  padding: '4px 10px', border: `1px solid ${trendingWindow === w ? SD.accent : SD.border}`,
                  borderRadius: 2, cursor: 'pointer',
                  background: trendingWindow === w ? SD.accentDim : 'transparent',
                  color: trendingWindow === w ? SD.accent : SD.textMuted,
                  transition: 'all .15s',
                }}>
                  {w === 'week' ? 'This Week' : w === 'month' ? 'This Month' : 'All Time'}
                </button>
              ))}
            </div>
          </div>

          {trendingLoading ? (
            <div style={{ fontFamily: SD.mono, fontSize: 13, color: SD.textMuted, padding: '24px 0' }}>
              Loading...
            </div>
          ) : trending.length === 0 ? (
            <div style={{ fontFamily: SD.mono, fontSize: 13, color: SD.textMuted, padding: '24px 0' }}>
              No public sets yet — be the first to share one.
            </div>
          ) : (
            <div className="sd-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 48px' }}>
              {trending.map((t, i) => (
                <TrendingRow key={`${t.artist}-${t.title}`} track={t} rank={i + 1} />
              ))}
            </div>
          )}
        </div>

        {/* ── Set Feed ── */}
        <div>
          {/* Feed header + filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: SD.mono, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: SD.textMuted, marginRight: 8 }}>
              Sets
            </div>

            {/* Genre filter */}
            <select
              value={genreFilter}
              onChange={e => setGenreFilter(e.target.value)}
              style={{
                fontFamily: SD.mono, fontSize: 12, color: SD.text,
                background: SD.surface, border: `1px solid ${SD.border}`,
                borderRadius: 3, padding: '5px 10px', cursor: 'pointer',
              }}
            >
              <option value="">All Genres</option>
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>

            {/* Slot filter */}
            <select
              value={slotFilter}
              onChange={e => setSlotFilter(e.target.value)}
              style={{
                fontFamily: SD.mono, fontSize: 12, color: SD.text,
                background: SD.surface, border: `1px solid ${SD.border}`,
                borderRadius: 3, padding: '5px 10px', cursor: 'pointer',
              }}
            >
              <option value="">All Slots</option>
              {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Sort */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {(['recent', 'popular'] as const).map(s => (
                <button key={s} onClick={() => setSort(s)} style={{
                  fontFamily: SD.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
                  padding: '4px 10px', border: `1px solid ${sort === s ? SD.accent : SD.border}`,
                  borderRadius: 2, cursor: 'pointer',
                  background: sort === s ? SD.accentDim : 'transparent',
                  color: sort === s ? SD.accent : SD.textMuted,
                  transition: 'all .15s',
                }}>
                  {s === 'recent' ? 'Recent' : 'Popular'}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {setsLoading && sets.length === 0 ? (
            <div style={{ fontFamily: SD.mono, fontSize: 13, color: SD.textMuted, padding: '40px 0' }}>
              Loading sets...
            </div>
          ) : sets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ fontFamily: SD.display, fontSize: 48, letterSpacing: 3, color: SD.textMuted, marginBottom: 12 }}>
                NOTHING YET
              </div>
              <div style={{ fontFamily: SD.mono, fontSize: 14, color: SD.textMuted }}>
                No sets match these filters. Generate a set and make it public to be the first.
              </div>
            </div>
          ) : (
            <>
              <div className="sd-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                {sets.map(s => (
                  <SetCard key={s.id} set={s} onLike={handleLike} />
                ))}
              </div>
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <SDButton ghost onClick={handleLoadMore} disabled={setsLoading}>
                    {setsLoading ? 'Loading...' : 'Load More'}
                  </SDButton>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
