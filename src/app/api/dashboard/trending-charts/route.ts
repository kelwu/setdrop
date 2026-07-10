import { after } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const maxDuration = 30;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeGenreKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toLastFmTag(genre: string): string {
  const map: Record<string, string> = {
    'tech house':    'tech house',
    'deep house':    'deep house',
    'afro house':    'afro house',
    'house':         'house',
    'techno':        'techno',
    'hip hop':       'hip-hop',
    'hip-hop':       'hip-hop',
    'trap':          'trap',
    'drill':         'uk drill',
    'r&b':           'rnb',
    'r and b':       'rnb',
    'soul':          'soul',
    'afrobeats':     'afrobeats',
    'afropop':       'afropop',
    'dancehall':     'dancehall',
    'drum and bass': 'drum and bass',
    'dnb':           'drum and bass',
    'trance':        'trance',
    'pop':           'pop',
    'latin':         'latin',
    'reggaeton':     'reggaeton',
    'edm':           'electronic',
    'electronic':    'electronic',
  };
  return map[genre.toLowerCase()] ?? genre.toLowerCase();
}

function normalize(s: string): string {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export interface TrendingTrack {
  artist: string;
  title: string;
  bpm?: number;
  inLibrary: boolean;
  artworkUrl?: string;
  beatportSearchUrl: string;
}

export interface TrendingGenreResult {
  genre: string;
  tracks: TrendingTrack[];
  fetchedAt: string;
}

async function fetchArtwork(artist: string, title: string): Promise<string | undefined> {
  try {
    const term = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=musicTrack&limit=1&media=music`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return undefined;
    const data = await res.json() as { results?: { artworkUrl100?: string }[] };
    const url = data.results?.[0]?.artworkUrl100;
    return url ? url.replace('100x100bb', '300x300bb') : undefined;
  } catch {
    return undefined;
  }
}

async function fetchFromLastFm(
  genres: string[],
  libSet: Set<string>,
  apiKey: string,
): Promise<Array<{ genre: string; tracks: TrendingTrack[] }>> {
  return Promise.all(
    genres.map(async (genre) => {
      const tag = toLastFmTag(genre);
      const params = new URLSearchParams({
        method: 'tag.getTopTracks',
        tag,
        api_key: apiKey,
        format: 'json',
        limit: '20',
      });
      try {
        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return { genre, tracks: [] };
        const data = await res.json() as { tracks?: { track?: unknown } };
        const raw = data.tracks?.track;
        if (!raw) return { genre, tracks: [] };
        const list = (Array.isArray(raw) ? raw : [raw]) as Array<{ name: string; artist: { name: string } }>;
        const top10 = list.slice(0, 10);

        const artworks = await Promise.all(
          top10.map(t => fetchArtwork(t.artist?.name ?? '', t.name ?? '')),
        );

        const tracks: TrendingTrack[] = top10.map((t, i) => {
          const artist = t.artist?.name ?? '';
          const title = t.name ?? '';
          const libKey = normalize(artist) + '||' + normalize(title);
          return {
            artist,
            title,
            inLibrary: libSet.has(libKey),
            artworkUrl: artworks[i],
            beatportSearchUrl: `https://www.beatport.com/search?q=${encodeURIComponent(`${artist} ${title}`).replace(/%20/g, '+')}`,
          };
        });

        return { genre, tracks };
      } catch {
        return { genre, tracks: [] };
      }
    }),
  );
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.LASTFM_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'LASTFM_API_KEY not configured' }, { status: 500 });

    const admin = createAdminClient();

    const { data: library } = await admin
      .from('serato_libraries')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!library) return NextResponse.json({ error: 'No library' }, { status: 404 });

    const [{ data: genreRows }, { data: libTracks }] = await Promise.all([
      admin.rpc('get_top_genres', { p_library_id: library.id, p_limit: 3 }),
      admin.from('serato_tracks').select('artist, title').eq('library_id', library.id).eq('in_library', true),
    ]);

    const topGenres = (genreRows ?? []).map((r: { genre: string }) => r.genre);
    if (!topGenres.length) return NextResponse.json({ results: [] });

    const libSet = new Set(
      (libTracks ?? []).map(t => normalize(t.artist ?? '') + '||' + normalize(t.title ?? '')),
    );

    const { data: cached } = await admin
      .from('trending_cache')
      .select('genre, tracks, fetched_at')
      .in('genre', topGenres);

    type CacheRow = { genre: string; tracks: TrendingTrack[]; fetched_at: string };
    const cachedMap = new Map((cached ?? []).map((c: CacheRow) => [c.genre, c]));

    const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();
    const missingGenres = topGenres.filter((g: string) => !cachedMap.has(g));
    const staleGenres = topGenres.filter((g: string) => {
      const row = cachedMap.get(g);
      return row && row.fetched_at < cutoff;
    });

    if (missingGenres.length > 0) {
      const results = await fetchFromLastFm(missingGenres, libSet, apiKey);
      const now = new Date().toISOString();
      for (const { genre, tracks } of results) {
        await admin.from('trending_cache').upsert({ genre, tracks, fetched_at: now });
        cachedMap.set(genre, { genre, tracks, fetched_at: now });
      }
    }

    if (staleGenres.length > 0) {
      after(async () => {
        try {
          const results = await fetchFromLastFm(staleGenres, libSet, apiKey);
          const now = new Date().toISOString();
          for (const { genre, tracks } of results) {
            const existing = cachedMap.get(genre);
            const finalTracks = tracks.length ? tracks : (existing?.tracks ?? []);
            await admin.from('trending_cache').upsert({ genre, tracks: finalTracks, fetched_at: now });
          }
        } catch (e) {
          console.error('[trending-charts] background refresh failed:', e instanceof Error ? e.message : e);
        }
      });
    }

    const results: TrendingGenreResult[] = topGenres
      .map((g: string) => {
        const row = cachedMap.get(g);
        return row
          ? { genre: g, tracks: row.tracks as TrendingTrack[], fetchedAt: row.fetched_at }
          : null;
      })
      .filter((r: TrendingGenreResult | null): r is TrendingGenreResult => r !== null && r.tracks.length > 0);

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[trending-charts]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
