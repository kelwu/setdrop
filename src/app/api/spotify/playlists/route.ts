import { NextResponse } from 'next/server';
import { spotifyGet } from '@/lib/spotify/client';

interface SpotifyPlaylist {
  id: string;
  name: string;
  tracks: { total: number };
  images: { url: string }[];
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
        playlists.push({
          id: p.id,
          name: p.name,
          trackCount: p.tracks.total,
          imageUrl: p.images[0]?.url,
        });
      }
      // next is an absolute URL from Spotify — strip the base for spotifyGet
      url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
    }

    return NextResponse.json({ playlists });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('Not connected') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
