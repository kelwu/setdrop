import { NextResponse } from 'next/server';
import { spotifyGet } from '@/lib/spotify/client';

interface SpotifyPlaylist {
  id: string;
  name: string;
  tracks: { total: number };
  images: { url: string }[];
  owner: { id: string };
}

interface SpotifyPlaylistsResponse {
  items: SpotifyPlaylist[];
  next: string | null;
}

export async function GET() {
  try {
    const playlists: { id: string; name: string; trackCount: number; imageUrl?: string }[] = [];
    let url: string | null = '/me/playlists?limit=50';

    while (url) {
      const data: SpotifyPlaylistsResponse = await spotifyGet<SpotifyPlaylistsResponse>(url);
      for (const p of data.items) {
        if (!p?.id) continue;
        // Spotify-owned playlists (Discover Weekly, Daily Mix, etc.) 403 on track access
        if (p.owner?.id === 'spotify') continue;
        playlists.push({
          id: p.id,
          name: p.name,
          trackCount: p.tracks?.total ?? 0,
          imageUrl: p.images?.[0]?.url,
        });
      }
      // next is an absolute URL from Spotify — strip the base for spotifyGet
      url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
    }

    return NextResponse.json({ playlists });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[spotify/playlists]', message);
    const status = message.includes('Not connected') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
