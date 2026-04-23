import { NextRequest, NextResponse } from 'next/server';
import { runSetlistPipeline } from '@/lib/agents/pipeline';
import { SetlistInput, LibraryTrack } from '@/lib/agents/types';
import { LIBRARY_TRACKS } from '@/lib/setdrop/constants';

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

    // Use provided tracks or fall back to demo library
    const library = tracks?.length ? tracks : getDemoLibrary();
    const setlist = await runSetlistPipeline(input, library);

    return NextResponse.json(setlist);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[generate-setlist] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
