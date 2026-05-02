import { NextRequest, NextResponse } from 'next/server';
import { isSpotifyConnected } from '@/lib/spotify/client';

export async function GET(req: NextRequest) {
  return NextResponse.json({ connected: isSpotifyConnected(req) });
}
