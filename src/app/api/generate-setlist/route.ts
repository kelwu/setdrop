import { NextRequest, NextResponse } from 'next/server';
import { runSetlistPipeline } from '@/lib/agents/pipeline';
import { SetlistInput, LibraryTrack } from '@/lib/agents/types';
import { LIBRARY_TRACKS } from '@/lib/setdrop/constants';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

function getDemoLibrary(): LibraryTrack[] {
  return LIBRARY_TRACKS.map(t => ({
    id: String(t.pos),
    artist: t.artist,
    title: t.title,
    bpm: t.bpm,
    key: t.key,
    energy: t.energy,
    genre: 'Afrobeats',
    isWishlist: t.wishlist,
    beatportSearchUrl: `https://www.beatport.com/search?q=${encodeURIComponent(`${t.artist} ${t.title}`)}`,
    bpmSupremeSearchUrl: `https://www.bpmsupreme.com/search?q=${encodeURIComponent(`${t.artist} ${t.title}`)}`,
    traxsourceSearchUrl: `https://www.traxsource.com/search?term=${encodeURIComponent(`${t.artist} ${t.title}`)}`,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { input: SetlistInput; tracks?: LibraryTrack[] };
    const { input, tracks } = body;

    if (!input?.primaryGenre || !input?.crowdContext || !input?.durationMinutes || !input?.lineupSlot) {
      return NextResponse.json({ error: 'Missing required fields: primaryGenre, crowdContext, durationMinutes, lineupSlot' }, { status: 400 });
    }

    // Use provided tracks, or fetch from Supabase if authenticated, or fall back to demo
    let library: LibraryTrack[] = tracks?.length ? tracks : [];
    if (!library.length) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: lib } = await supabase
            .from('serato_libraries')
            .select('id')
            .eq('user_id', user.id)
            .single();
          if (lib) {
            const { data: rows } = await supabase
              .from('serato_tracks')
              .select('id, artist, title, bpm, key, genre, file_path, lastfm_tags')
              .eq('library_id', lib.id)
              .order('artist');
            if (rows?.length) {
              library = rows.map(t => ({
                id: t.id,
                artist: t.artist ?? '',
                title: t.title ?? '',
                bpm: t.bpm ?? 0,
                key: t.key ?? '',
                genre: t.genre ?? undefined,
                filePath: t.file_path ?? undefined,
                lastfmTags: t.lastfm_tags ?? [],
                isWishlist: false,
                enrichmentSource: 'serato' as const,
              }));
            }
          }
          if (!library.length) {
            const { data: wish } = await supabase
              .from('wishlist_tracks')
              .select('id, artist, title, bpm, key, genre, beatport_search_url, bpm_supreme_search_url, traxsource_search_url')
              .eq('user_id', user.id)
              .eq('status', 'wishlist');
            if (wish?.length) {
              library.push(...wish.map(w => ({
                id: w.id,
                artist: w.artist ?? '',
                title: w.title ?? '',
                bpm: w.bpm ?? 0,
                key: w.key ?? '',
                genre: w.genre ?? undefined,
                isWishlist: true,
                beatportSearchUrl: w.beatport_search_url ?? undefined,
                bpmSupremeSearchUrl: w.bpm_supreme_search_url ?? undefined,
                traxsourceSearchUrl: w.traxsource_search_url ?? undefined,
                enrichmentSource: 'manual' as const,
              })));
            }
          }
        }
      } catch { /* non-fatal */ }
    }
    if (!library.length) library = getDemoLibrary();

    // Fetch recently played tracks for do-not-repeat logic
    let recentlyPlayed: string[] = [];
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const { data: gigs } = await supabase
          .from('gig_history')
          .select('setlist_id')
          .eq('user_id', user.id)
          .gte('played_at', cutoff.toISOString())
          .order('played_at', { ascending: false })
          .limit(10);
        const ids = (gigs ?? []).map(g => g.setlist_id).filter(Boolean) as string[];
        if (ids.length) {
          const { data: played } = await supabase
            .from('setlists')
            .select('tracks_json')
            .in('id', ids);
          const seen = new Set<string>();
          (played ?? []).forEach(s => {
            if (Array.isArray(s.tracks_json)) {
              (s.tracks_json as Array<{ artist: string; title: string }>).forEach(t => {
                if (t.artist && t.title) seen.add(`${t.artist} — ${t.title}`);
              });
            }
          });
          recentlyPlayed = Array.from(seen);
        }
      }
    } catch { /* non-fatal — generation proceeds without do-not-repeat */ }

    const setlist = await runSetlistPipeline(input, library, recentlyPlayed);

    return NextResponse.json(setlist);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[generate-setlist] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
