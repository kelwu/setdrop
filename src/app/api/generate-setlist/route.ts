import { NextRequest, NextResponse } from 'next/server';
import { runSetlistPipeline } from '@/lib/agents/pipeline';
import { SetlistInput, LibraryTrack, GeneratedSetlist } from '@/lib/agents/types';
import { LIBRARY_TRACKS } from '@/lib/setdrop/constants';
import { createClient } from '@/lib/supabase/server';
import { recordUsage, usageToday, costToday, recordCost, type CallUsage } from '@/lib/api-usage';
import { PLANS } from '@/lib/stripe';

export const maxDuration = 300;

function getDemoLibrary(): LibraryTrack[] {
  return LIBRARY_TRACKS.map(t => ({
    id: String(t.pos),
    artist: t.artist,
    title: t.title,
    bpm: t.bpm,
    key: t.key,
    genre: 'Afrobeats',
    isWishlist: t.wishlist,
    beatportSearchUrl: `https://www.beatport.com/search?q=${encodeURIComponent(`${t.artist} ${t.title}`)}`,
    bpmSupremeSearchUrl: `https://www.bpmsupreme.com/search?q=${encodeURIComponent(`${t.artist} ${t.title}`)}`,
    traxsourceSearchUrl: `https://www.traxsource.com/search?term=${encodeURIComponent(`${t.artist} ${t.title}`)}`,
    djcitySearchUrl: `https://www.djcity.com/search?q=${encodeURIComponent(`${t.artist} ${t.title}`)}`,
  }));
}

type StreamEvent =
  | { type: 'step'; step: number; message: string }
  | { type: 'complete'; setlist: GeneratedSetlist; excludedCount: number; libraryTracksUsed: number }
  | { type: 'error'; message: string };

function encode(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(req: NextRequest) {
  // Parse and validate body before streaming starts so we can return real HTTP errors
  let body: { input: SetlistInput; tracks?: LibraryTrack[] };
  try {
    body = await req.json() as { input: SetlistInput; tracks?: LibraryTrack[] };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { input, tracks } = body;
  if (!input?.primaryGenre || !input?.crowdContext || !input?.durationMinutes || !input?.lineupSlot) {
    return NextResponse.json(
      { error: 'Missing required fields: primaryGenre, crowdContext, durationMinutes, lineupSlot' },
      { status: 400 }
    );
  }

  // Auth + rate limiting — must complete before streaming starts so errors are real HTTP responses
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { banned, isBeta: dbBeta } = await recordUsage(user.id, 'generate-setlist');
  if (banned) return NextResponse.json({ error: 'account_suspended' }, { status: 403 });

  // Beta testers (env allowlist or admin-granted flag) bypass rate limiting entirely
  const betaEmails = (process.env.BETA_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isBeta = dbBeta || (!!user.email && betaEmails.includes(user.email.toLowerCase()));

  // Generation is unlimited for normal use; enforce only anti-abuse guards (the
  // paywall is on exports, not generation): a soft daily count cap AND a per-user
  // daily estimated-spend ceiling, since generation is the real COGS driver.
  let tier: 'free' | 'pro' = 'free';
  if (!isBeta) {
    const { data: userRow } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();
    tier = (userRow?.subscription_tier ?? 'free') as 'free' | 'pro';
    const dailyCap = PLANS[tier].dailyGenCap;
    if (dailyCap != null) {
      // recordUsage already logged this call, so `used` includes it.
      const used = await usageToday(user.id, 'generate-setlist');
      if (used > dailyCap) {
        return NextResponse.json({ error: 'daily_limit', tier, limit: dailyCap }, { status: 429 });
      }
    }
    const ceiling = PLANS[tier].dailyCostCeilingUsd;
    if (ceiling != null && (await costToday(user.id)) >= ceiling) {
      return NextResponse.json({ error: 'cost_limit', tier }, { status: 429 });
    }
  }

  // Start streaming response
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      await writer.write(encode({ type: 'step', step: 0, message: 'Analyzing your library...' }));

      // Load library
      let library: LibraryTrack[] = tracks?.length ? tracks : [];
      if (!library.length) {
        try {
          if (user) {
            const { data: lib } = await supabase
              .from('serato_libraries')
              .select('id')
              .eq('user_id', user.id)
              .single();
            if (lib) {
              const genre = input.primaryGenre;
              const sanitizeSeed = (s: string) =>
                s.replace(/[,()[\]—–]/g, ' ').replace(/\s+/g, ' ').trim();
              const seedQueries = (input.seedTracks ?? []).map(seed => {
                const safe = sanitizeSeed(seed);
                return supabase.from('serato_tracks')
                  .select('id, artist, title, bpm, key, genre, file_path, lastfm_tags')
                  .eq('library_id', lib.id)
                  .or(`title.ilike.%${safe}%,artist.ilike.%${safe}%`)
                  .limit(5);
              });
              const [{ data: genreRows }, { data: nullGenreRows }, { data: otherRows }, ...seedResults] =
                await Promise.all([
                  supabase.from('serato_tracks')
                    .select('id, artist, title, bpm, key, genre, file_path, lastfm_tags')
                    .eq('library_id', lib.id).ilike('genre', `%${genre}%`).limit(400),
                  supabase.from('serato_tracks')
                    .select('id, artist, title, bpm, key, genre, file_path, lastfm_tags')
                    .eq('library_id', lib.id).is('genre', null).limit(100),
                  supabase.from('serato_tracks')
                    .select('id, artist, title, bpm, key, genre, file_path, lastfm_tags')
                    .eq('library_id', lib.id).not('genre', 'ilike', `%${genre}%`).limit(100),
                  ...seedQueries,
                ]);
              const seedRows = seedResults.flatMap(r => r.data ?? []);
              let allRows = [...(genreRows ?? []), ...(nullGenreRows ?? []), ...(otherRows ?? [])];
              if (!allRows.length) {
                const { data: fallbackRows } = await supabase.from('serato_tracks')
                  .select('id, artist, title, bpm, key, genre, file_path, lastfm_tags')
                  .eq('library_id', lib.id).limit(500);
                allRows = fallbackRows ?? [];
              }
              const seen = new Set(allRows.map(r => r.id));
              for (const r of seedRows) { if (!seen.has(r.id)) { allRows.push(r); seen.add(r.id); } }
              if (allRows.length) {
                library = allRows.map(t => ({
                  id: t.id, artist: t.artist ?? '', title: t.title ?? '',
                  bpm: t.bpm ?? 0, key: t.key ?? '', genre: t.genre ?? undefined,
                  filePath: t.file_path ?? undefined, lastfmTags: t.lastfm_tags ?? [],
                  isWishlist: false, enrichmentSource: 'serato' as const,
                }));
              }
            }
            if (!library.length) {
              const { data: wish } = await supabase
                .from('wishlist_tracks')
                .select('id, artist, title, bpm, key, genre, beatport_search_url, bpm_supreme_search_url, traxsource_search_url, djcity_search_url')
                .eq('user_id', user.id).eq('status', 'wishlist');
              if (wish?.length) {
                library.push(...wish.map(w => ({
                  id: w.id, artist: w.artist ?? '', title: w.title ?? '',
                  bpm: w.bpm ?? 0, key: w.key ?? '', genre: w.genre ?? undefined,
                  isWishlist: true,
                  beatportSearchUrl: w.beatport_search_url ?? undefined,
                  bpmSupremeSearchUrl: w.bpm_supreme_search_url ?? undefined,
                  traxsourceSearchUrl: w.traxsource_search_url ?? undefined,
                  djcitySearchUrl: w.djcity_search_url ?? undefined,
                  enrichmentSource: 'manual' as const,
                })));
              }
            }
          }
        } catch { /* non-fatal — fall through to demo */ }
      }
      if (!library.length) library = getDemoLibrary();

      // Fetch recently played tracks
      let recentlyPlayed: string[] = [];
      try {
        if (user) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 90);
          const { data: gigs } = await supabase
            .from('gig_history').select('setlist_id').eq('user_id', user.id)
            .gte('played_at', cutoff.toISOString()).order('played_at', { ascending: false }).limit(10);
          const ids = (gigs ?? []).map(g => g.setlist_id).filter(Boolean) as string[];
          if (ids.length) {
            const { data: played } = await supabase.from('setlists')
              .select('tracks_json').in('id', ids);
            const seenTracks = new Set<string>();
            (played ?? []).forEach(s => {
              if (Array.isArray(s.tracks_json)) {
                (s.tracks_json as Array<{ artist: string; title: string }>).forEach(t => {
                  if (t.artist && t.title) seenTracks.add(`${t.artist} — ${t.title}`);
                });
              }
            });
            recentlyPlayed = Array.from(seenTracks);
          }
        }
      } catch { /* non-fatal */ }

      const usages: CallUsage[] = [];
      const setlist = await runSetlistPipeline(
        input, library, recentlyPlayed,
        (event) => { writer.write(encode(event)); },
        (u) => { usages.push(u); },
      );
      await recordCost(user.id, 'generate-setlist', usages);

      await writer.write(encode({
        type: 'complete',
        setlist,
        excludedCount: recentlyPlayed.length,
        libraryTracksUsed: library.length,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[generate-setlist] Error:', message);
      await writer.write(encode({ type: 'error', message }));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
