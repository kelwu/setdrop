import { after } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const maxDuration = 30;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type BeatportSource = { source: 'beatport'; slug: string; id: number };
type AppleSource   = { source: 'apple'; genreId: number };
type GenreSource   = BeatportSource | AppleSource;

// Maps user library genre labels → chart source
const GENRE_MAP: Record<string, GenreSource> = {
  'tech house':             { source: 'beatport', slug: 'tech-house',             id: 11 },
  'deep house':             { source: 'beatport', slug: 'deep-house',             id: 12 },
  'afro house':             { source: 'beatport', slug: 'afro-house',             id: 89 },
  'house':                  { source: 'beatport', slug: 'house',                  id: 5  },
  'techno':                 { source: 'beatport', slug: 'techno-peak-time-driving', id: 6 },
  'hard techno':            { source: 'beatport', slug: 'hard-techno',            id: 2  },
  'melodic house':          { source: 'beatport', slug: 'melodic-house-techno',   id: 90 },
  'melodic house & techno': { source: 'beatport', slug: 'melodic-house-techno',   id: 90 },
  'melodic techno':         { source: 'beatport', slug: 'melodic-house-techno',   id: 90 },
  'drum and bass':          { source: 'beatport', slug: 'drum-bass',              id: 1  },
  'drum & bass':            { source: 'beatport', slug: 'drum-bass',              id: 1  },
  'dnb':                    { source: 'beatport', slug: 'drum-bass',              id: 1  },
  'amapiano':               { source: 'beatport', slug: 'amapiano',              id: 98 },
  'trance':                 { source: 'beatport', slug: 'trance-main-floor',      id: 7  },
  'progressive house':      { source: 'beatport', slug: 'progressive-house',      id: 15 },
  'bass house':             { source: 'beatport', slug: 'bass-house',             id: 91 },
  'minimal':                { source: 'beatport', slug: 'minimal-deep-tech',      id: 14 },
  'minimal / deep tech':    { source: 'beatport', slug: 'minimal-deep-tech',      id: 14 },
  'nu disco':               { source: 'beatport', slug: 'nu-disco-disco',         id: 50 },
  'disco':                  { source: 'beatport', slug: 'nu-disco-disco',         id: 50 },
  'indie dance':            { source: 'beatport', slug: 'indie-dance',            id: 37 },
  'funky house':            { source: 'beatport', slug: 'funky-house',            id: 81 },
  'jackin house':           { source: 'beatport', slug: 'jackin-house',           id: 97 },
  'organic house':          { source: 'beatport', slug: 'organic-house',          id: 93 },
  'hip hop':                { source: 'apple',    genreId: 18 },
  'hip-hop':                { source: 'apple',    genreId: 18 },
  'hip hop/rap':            { source: 'apple',    genreId: 18 },
  'trap':                   { source: 'apple',    genreId: 18 },
  'drill':                  { source: 'apple',    genreId: 18 },
  'afrobeats':              { source: 'apple',    genreId: 18 },
  'afropop':                { source: 'apple',    genreId: 18 },
  'dancehall':              { source: 'apple',    genreId: 18 },
  'r&b':                    { source: 'apple',    genreId: 15 },
  'r and b':                { source: 'apple',    genreId: 15 },
  'rnb':                    { source: 'apple',    genreId: 15 },
  'soul':                   { source: 'apple',    genreId: 15 },
  'latin':                  { source: 'apple',    genreId: 27 },
  'reggaeton':              { source: 'apple',    genreId: 27 },
  'pop':                    { source: 'apple',    genreId: 14 },
  'dance pop':              { source: 'apple',    genreId: 14 },
  'edm':                    { source: 'beatport', slug: 'mainstage',              id: 96 },
  'electronic':             { source: 'beatport', slug: 'melodic-house-techno',   id: 90 },
};

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

// Beatport: scrape SSR HTML and extract __NEXT_DATA__ JSON
async function fetchFromBeatport(
  genre: string,
  src: BeatportSource,
  libSet: Set<string>,
): Promise<{ genre: string; tracks: TrendingTrack[] }> {
  try {
    const res = await fetch(
      `https://www.beatport.com/genre/${src.slug}/${src.id}/top-100`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!res.ok) return { genre, tracks: [] };

    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
    if (!match) return { genre, tracks: [] };

    const nd = JSON.parse(match[1]) as {
      props?: {
        pageProps?: {
          dehydratedState?: {
            queries?: Array<{
              state?: {
                data?: {
                  results?: Array<{
                    name: string;
                    artists: Array<{ name: string }>;
                    bpm?: number;
                    release?: { image?: { dynamic_uri?: string } };
                  }>;
                };
              };
            }>;
          };
        };
      };
    };

    const results = nd?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.results ?? [];
    const top10 = results.slice(0, 10);

    const tracks: TrendingTrack[] = top10.map(t => {
      const artist = t.artists?.map(a => a.name).join(', ') ?? '';
      const title  = t.name ?? '';
      const libKey = normalize(artist) + '||' + normalize(title);
      const artworkUrl = t.release?.image?.dynamic_uri?.replace('{w}x{h}', '300x300');
      return {
        artist,
        title,
        bpm: t.bpm,
        inLibrary: libSet.has(libKey),
        artworkUrl,
        beatportSearchUrl: `https://www.beatport.com/search?q=${encodeURIComponent(`${artist} ${title}`).replace(/%20/g, '+')}`,
      };
    });

    return { genre, tracks };
  } catch {
    return { genre, tracks: [] };
  }
}

// Apple Music RSS: current charts by genre ID
async function fetchFromApple(
  genre: string,
  src: AppleSource,
  libSet: Set<string>,
): Promise<{ genre: string; tracks: TrendingTrack[] }> {
  try {
    const res = await fetch(
      `https://rss.marketingtools.apple.com/api/v2/us/music/most-played/25/songs.json?genreId=${src.genreId}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return { genre, tracks: [] };

    const data = await res.json() as {
      feed?: {
        results?: Array<{
          name: string;
          artistName: string;
          artworkUrl100?: string;
        }>;
      };
    };

    const top10 = (data?.feed?.results ?? []).slice(0, 10);

    const tracks: TrendingTrack[] = top10.map(t => {
      const artist = t.artistName ?? '';
      const title  = t.name ?? '';
      const libKey = normalize(artist) + '||' + normalize(title);
      const artworkUrl = t.artworkUrl100?.replace('100x100bb', '300x300bb');
      return {
        artist,
        title,
        inLibrary: libSet.has(libKey),
        artworkUrl,
        beatportSearchUrl: `https://www.beatport.com/search?q=${encodeURIComponent(`${artist} ${title}`).replace(/%20/g, '+')}`,
      };
    });

    return { genre, tracks };
  } catch {
    return { genre, tracks: [] };
  }
}

async function fetchGenreTracks(
  genre: string,
  libSet: Set<string>,
): Promise<{ genre: string; tracks: TrendingTrack[] }> {
  const src = GENRE_MAP[normalize(genre)];
  if (!src) return { genre, tracks: [] };
  return src.source === 'beatport'
    ? fetchFromBeatport(genre, src, libSet)
    : fetchFromApple(genre, src, libSet);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const staleGenres   = topGenres.filter((g: string) => {
      const row = cachedMap.get(g);
      return row && row.fetched_at < cutoff;
    });

    if (missingGenres.length > 0) {
      const fetched = await Promise.all(missingGenres.map((g: string) => fetchGenreTracks(g, libSet)));
      const now = new Date().toISOString();
      for (const { genre, tracks } of fetched) {
        await admin.from('trending_cache').upsert({ genre, tracks, fetched_at: now });
        cachedMap.set(genre, { genre, tracks, fetched_at: now });
      }
    }

    if (staleGenres.length > 0) {
      after(async () => {
        try {
          const fetched = await Promise.all(staleGenres.map((g: string) => fetchGenreTracks(g, libSet)));
          const now = new Date().toISOString();
          for (const { genre, tracks } of fetched) {
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
