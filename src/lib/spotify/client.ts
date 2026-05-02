import { cookies } from 'next/headers';

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getValidSpotifyToken(): Promise<string | null> {
  const jar = await cookies();
  const accessToken = jar.get('spotify_access_token')?.value;
  if (accessToken) return accessToken;

  const refreshToken = jar.get('spotify_refresh_token')?.value;
  if (!refreshToken) return null;

  const data = await refreshAccessToken(refreshToken);
  if (!data) {
    jar.delete('spotify_refresh_token');
    return null;
  }

  const isProd = process.env.NODE_ENV === 'production';
  jar.set('spotify_access_token', data.access_token, {
    httpOnly: true, secure: isProd, sameSite: 'lax',
    maxAge: data.expires_in - 60, path: '/',
  });
  if (data.refresh_token) {
    jar.set('spotify_refresh_token', data.refresh_token, {
      httpOnly: true, secure: isProd, sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, path: '/',
    });
  }
  return data.access_token;
}

export async function spotifyGet<T = unknown>(path: string): Promise<T> {
  const token = await getValidSpotifyToken();
  if (!token) throw new Error('Not connected to Spotify');

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Spotify ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function isSpotifyConnected(req: { cookies: { has: (name: string) => boolean } }): boolean {
  return req.cookies.has('spotify_access_token') || req.cookies.has('spotify_refresh_token');
}
