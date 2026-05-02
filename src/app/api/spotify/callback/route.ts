import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/?spotify_error=denied', req.url));
  }

  const storedState = req.cookies.get('spotify_oauth_state')?.value;
  if (!storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/?spotify_error=state', req.url));
  }

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: new URL('/api/spotify/callback', req.url).toString(),
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/?spotify_error=token', req.url));
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const isProd = process.env.NODE_ENV === 'production';
  const response = NextResponse.redirect(new URL('/?goto=library', req.url));

  response.cookies.set('spotify_access_token', access_token, {
    httpOnly: true, secure: isProd, sameSite: 'lax',
    maxAge: expires_in - 60, path: '/',
  });
  response.cookies.set('spotify_refresh_token', refresh_token, {
    httpOnly: true, secure: isProd, sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, path: '/',
  });
  response.cookies.delete('spotify_oauth_state');
  return response;
}
