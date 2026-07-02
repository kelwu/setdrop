import { after } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recordUsage } from '@/lib/api-usage';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 120;

const MODEL = 'claude-sonnet-4-6';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Normalize genre names so the model's spelling ("Hip-Hop") matches the
// genre we requested and cache by ("Hip Hop").
function normalizeGenreKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface TrendingTrack {
  artist: string;
  title: string;
  bpm?: number;
  chartSource: string;
  chartUrl: string;
  beatportSearchUrl: string;
}

export interface TrendingGenreResult {
  genre: string;
  tracks: TrendingTrack[];
  fetchedAt: string;
}

const TRENDING_TOOL: Anthropic.Tool = {
  name: 'report_trending_tracks',
  description: 'Report currently trending tracks per genre from the appropriate chart source.',
  input_schema: {
    type: 'object',
    required: ['results'],
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          required: ['genre', 'tracks'],
          properties: {
            genre: { type: 'string' },
            tracks: {
              type: 'array',
              items: {
                type: 'object',
                required: ['artist', 'title', 'chartSource', 'chartUrl', 'beatportSearchUrl'],
                properties: {
                  artist: { type: 'string' },
                  title: { type: 'string' },
                  bpm: { type: 'number' },
                  chartSource: { type: 'string' },
                  chartUrl: { type: 'string' },
                  beatportSearchUrl: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
};

const WEB_SEARCH: Anthropic.Messages.WebSearchTool20260209 = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 3,
  allowed_domains: [
    'www.beatport.com', 'www.djcity.com', 'www.bpmsupreme.com',
    'www.billboard.com', 'www.audiomack.com', 'ra.co', 'djmag.com',
  ],
};

const SYSTEM = `You are a DJ trend analyst. For each genre provided, find the top 5 currently trending tracks that a DJ would want to know about. Use the most relevant chart source per genre:

- House / Tech House / Afro House / Deep House / Progressive House → Beatport Top 100 (genre-specific chart)
- Techno / Minimal / Industrial → Beatport Top 100 Techno
- Drum & Bass / Jungle → Beatport Top 100 Drum & Bass
- Trance / Uplifting → Beatport Top 100 Trance
- Hip Hop / Trap / Drill / Boom Bap → DJcity charts or Billboard Hot Rap Songs
- R&B / Soul → Billboard Hot R&B/Hip-Hop Songs or DJcity R&B
- Pop / Dance Pop / Top 40 → Billboard Hot 100
- Latin / Reggaeton / Cumbia → Billboard Latin Charts
- Afrobeats / Afropop / Dancehall → Audiomack Trending or Apple Music Afrobeats
- EDM / Big Room / Mainstage → Beatport Top 100 Big Room or Billboard Dance/Electronic
- Col House (Colombian House) / Latin House → Beatport Afro House or Latin House chart

Do one web search per genre (up to 3 total). Find real, specific artist/title pairs trending RIGHT NOW in 2026.
Set chartSource to a readable name like "Beatport Top 100 House" or "Billboard Hot Rap Songs".
Set chartUrl to the actual chart URL you found the tracks on.
Set beatportSearchUrl to https://www.beatport.com/search?q=ARTIST+TITLE (URL-encode artist and title, replace spaces with +).
Then call report_trending_tracks with all results.`;

async function fetchFromAI(genres: string[]): Promise<Array<{ genre: string; tracks: TrendingTrack[] }>> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userMsg = `Search for the top 5 trending tracks RIGHT NOW in 2026 for each of these DJ genres: ${genres.join(', ')}. Check the appropriate chart source for each genre.`;

  // Phase 1: force a web search — tool_choice 'any' with only WEB_SEARCH means the model must search
  const searched = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
    tools: [WEB_SEARCH],
    tool_choice: { type: 'any' },
  });

  // Phase 2: take the search results in context, force structured output
  const forced = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      { role: 'user', content: userMsg },
      { role: 'assistant', content: searched.content as unknown as Anthropic.Messages.ContentBlockParam[] },
      { role: 'user', content: 'Based on the chart data you just found, call report_trending_tracks with the top 5 tracks per genre.' },
    ],
    tools: [TRENDING_TOOL],
    tool_choice: { type: 'tool', name: 'report_trending_tracks' },
  });

  const block = forced.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
  );
  return (block?.input as { results: Array<{ genre: string; tracks: TrendingTrack[] }> })?.results ?? [];
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

    // Get user's top 3 genres via SQL aggregate — avoids fetching all rows
    const { data: genreRows } = await admin
      .rpc('get_top_genres', { p_library_id: library.id, p_limit: 3 });

    const topGenres = (genreRows ?? []).map((r: { genre: string }) => r.genre);

    if (!topGenres.length) return NextResponse.json({ results: [] });

    // Load all cached entries regardless of age
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

    // Cold miss: fetch synchronously so the cache is populated before responding.
    // Background refresh (after()) is only safe when there's already cached data
    // to serve — otherwise every request triggers a new AI call in an infinite loop.
    if (missingGenres.length > 0) {
      await recordUsage(user.id, 'trending-charts');
      const aiResults = await fetchFromAI(missingGenres);
      // Match AI-returned genre names back to the requested names by a normalized
      // key, so "Hip-Hop" from the model maps to the "Hip Hop" we queried by.
      const byNorm = new Map(aiResults.map(r => [normalizeGenreKey(r.genre), r]));
      const now = new Date().toISOString();
      // CRITICAL: write a row for EVERY requested genre, keyed by the requested
      // name, even if the AI returned nothing or a differently-spelled name.
      // This guarantees the next request is a cache hit and cannot re-trigger a
      // fetch until the row goes stale — preventing both the retry loop and the
      // per-load AI leak that caused the runaway billing.
      for (const g of missingGenres) {
        const match = byNorm.get(normalizeGenreKey(g));
        const tracks = match?.tracks ?? [];
        await admin.from('trending_cache').upsert({ genre: g, tracks, fetched_at: now });
        cachedMap.set(g, { genre: g, tracks, fetched_at: now });
      }
    }

    // Stale refresh: serve the cached data immediately, refresh in the background.
    // Bump fetched_at for every stale genre (keyed by the requested name) even if
    // the model returns nothing — otherwise a name mismatch would leave the row
    // perpetually stale and fire a background call on every single load.
    if (staleGenres.length > 0) {
      after(async () => {
        try {
          await recordUsage(user.id, 'trending-charts');
          const aiResults = await fetchFromAI(staleGenres);
          const byNorm = new Map(aiResults.map(r => [normalizeGenreKey(r.genre), r]));
          const now = new Date().toISOString();
          for (const g of staleGenres) {
            const match = byNorm.get(normalizeGenreKey(g));
            // Only overwrite tracks when the model actually returned some; always
            // bump fetched_at so the row leaves the stale window.
            const existing = cachedMap.get(g);
            const tracks = match?.tracks?.length ? match.tracks : (existing?.tracks ?? []);
            await admin.from('trending_cache').upsert({ genre: g, tracks, fetched_at: now });
          }
        } catch (e) {
          console.error('[trending-charts] background refresh failed:', e instanceof Error ? e.message : e);
        }
      });
    }

    // Include only genres that actually have tracks. Empty-track rows are still
    // cached (above) so they won't be re-fetched, but we don't render blank columns.
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
