import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { spotifyGet } from '@/lib/spotify/client';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  external_urls: { spotify: string };
}

interface SpotifyPlaylistTracksResponse {
  items: { track: SpotifyTrack | null }[];
  next: string | null;
}

function buildStoreUrls(artist: string, title: string) {
  const q = encodeURIComponent(`${artist} ${title}`);
  return {
    beatport_search_url: `https://www.beatport.com/search/tracks?q=${q}`,
    bpm_supreme_search_url: `https://www.bpmsupreme.com/search?q=${q}`,
    traxsource_search_url: `https://www.traxsource.com/search?term=${q}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { playlistId } = await req.json() as { playlistId: string };
    if (!playlistId) return NextResponse.json({ error: 'playlistId required' }, { status: 400 });

    // Fetch all tracks from playlist (paginated)
    const tracks: SpotifyTrack[] = [];
    let url: string | null = `/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,artists,external_urls)),next`;

    while (url) {
      const data: SpotifyPlaylistTracksResponse = await spotifyGet<SpotifyPlaylistTracksResponse>(url);
      for (const item of data.items) {
        if (item.track) tracks.push(item.track);
      }
      url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
    }

    if (!tracks.length) {
      return NextResponse.json({ imported: 0, skipped: 0 });
    }

    // Fetch existing spotify IDs for this user to detect duplicates
    const { data: existing } = await supabase
      .from('wishlist_tracks')
      .select('spotify_id')
      .eq('user_id', user.id)
      .not('spotify_id', 'is', null);

    const existingIds = new Set((existing ?? []).map(r => r.spotify_id as string));

    const toInsert = tracks
      .filter(t => !existingIds.has(t.id))
      .map(t => {
        const artist = t.artists.map(a => a.name).join(', ');
        const title = t.name;
        return {
          user_id: user.id,
          artist,
          title,
          spotify_id: t.id,
          spotify_url: t.external_urls.spotify,
          status: 'wishlist' as const,
          enrichment_source: 'pending' as const,
          ...buildStoreUrls(artist, title),
        };
      });

    if (toInsert.length) {
      const { error } = await supabase.from('wishlist_tracks').insert(toInsert);
      if (error) throw error;
    }

    return NextResponse.json({
      imported: toInsert.length,
      skipped: tracks.length - toInsert.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('Not connected') ? 401 : 500;
    console.error('[spotify/import]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
