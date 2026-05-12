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
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; error_description?: string };
    console.error('[spotify/refresh] failed', res.status, body);
    return null;
  }
  return res.json();
}

async function getTokenViaRefresh(): Promise<string | null> {
  const jar = await cookies();
  const refreshToken = jar.get('spotify_refresh_token')?.value;
  if (!refreshToken) return null;

  const data = await refreshAccessToken(refreshToken);
  if (!data) {
    try { jar.delete('spotify_refresh_token'); } catch { /* read-only context, skip */ }
    return null;
  }

  const isProd = process.env.NODE_ENV === 'production';
  try {
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
  } catch { /* read-only cookie context — token still valid for this request */ }

  return data.access_token;
}

export async function getValidSpotifyToken(): Promise<string | null> {
  const jar = await cookies();
  const accessToken = jar.get('spotify_access_token')?.value;
  if (accessToken) return accessToken;
  return getTokenViaRefresh();
}

export async function spotifyGet<T = unknown>(path: string): Promise<T> {
  let token = await getValidSpotifyToken();
  if (!token) throw new Error('Not connected to Spotify');

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  // Access token stale (cookie TTL outlived Spotify token validity) — force refresh once
  if (res.status === 401) {
    console.warn('[spotify] 401 on', path, '— forcing token refresh');
    try {
      const jar = await cookies();
      jar.delete('spotify_access_token');
    } catch { /* ok if read-only */ }

    token = await getTokenViaRefresh();
    if (!token) throw new Error('Not connected to Spotify');

    const retry = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!retry.ok) {
      const err = await retry.json().catch(() => ({})) as { error?: { message?: string } };
      const msg = err.error?.message ?? `Spotify ${retry.status}`;
      console.error('[spotify] retry failed on', path, msg);
      throw new Error(msg);
    }
    return retry.json() as Promise<T>;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    const msg = err.error?.message ?? `Spotify ${res.status}`;
    console.error('[spotify] error on', path, msg);
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function isSpotifyConnected(req: { cookies: { has: (name: string) => boolean } }): boolean {
  return req.cookies.has('spotify_access_token') || req.cookies.has('spotify_refresh_token');
}
