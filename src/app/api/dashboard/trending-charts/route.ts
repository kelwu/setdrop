import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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
  const userMsg = `Find the top 5 trending tracks right now for each of these DJ genres: ${genres.join(', ')}`;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
    tools: [WEB_SEARCH, TRENDING_TOOL],
    tool_choice: { type: 'auto' },
  });

  const toolBlock = msg.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock =>
      b.type === 'tool_use' && b.name === 'report_trending_tracks',
  );
  if (toolBlock) return (toolBlock.input as { results: Array<{ genre: string; tracks: TrendingTrack[] }> }).results;

  const forced = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      { role: 'user', content: userMsg },
      { role: 'assistant', content: msg.content as unknown as Anthropic.Messages.ContentBlockParam[] },
      { role: 'user', content: 'Now call report_trending_tracks with your results.' },
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

    // Check cache — entries fresher than 24h are valid
    const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();
    const { data: cached } = await admin
      .from('trending_cache')
      .select('genre, tracks, fetched_at')
      .in('genre', topGenres)
      .gte('fetched_at', cutoff);

    type CacheRow = { genre: string; tracks: TrendingTrack[]; fetched_at: string };
    const cachedMap = new Map((cached ?? []).map((c: CacheRow) => [c.genre, c]));
    const staleGenres = topGenres.filter((g: string) => !cachedMap.has(g));

    // Fetch fresh data for any stale/missing genres
    if (staleGenres.length > 0) {
      const aiResults = await fetchFromAI(staleGenres);
      const now = new Date().toISOString();

      for (const r of aiResults) {
        await admin.from('trending_cache').upsert({
          genre: r.genre,
          tracks: r.tracks,
          fetched_at: now,
        });
        cachedMap.set(r.genre, { genre: r.genre, tracks: r.tracks, fetched_at: now });
      }
    }

    const results: TrendingGenreResult[] = topGenres
      .map((g: string) => {
        const row = cachedMap.get(g);
        return row
          ? { genre: g, tracks: row.tracks as TrendingTrack[], fetchedAt: row.fetched_at }
          : null;
      })
      .filter((r: TrendingGenreResult | null): r is TrendingGenreResult => r !== null);

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[trending-charts]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
