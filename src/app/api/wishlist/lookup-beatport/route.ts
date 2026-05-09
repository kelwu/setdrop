import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 15;

interface BeatportTrack {
  id?: number;
  name?: string;
  bpm?: number;
  key?: { camelot_number?: number; camelot_letter?: string; name?: string };
  genres?: Array<{ name: string }>;
  artists?: Array<{ name: string }>;
}

function extractId(url: string): string | null {
  const m = url.match(/\/track\/[^/]+\/(\d+)/);
  return m ? m[1] : null;
}

function toCamelot(key?: BeatportTrack['key']): string {
  if (!key) return '';
  if (key.camelot_number != null && key.camelot_letter) {
    return `${key.camelot_number}${key.camelot_letter}`;
  }
  return key.name ?? '';
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json() as { url?: string };
    const id = extractId(url ?? '');
    if (!id) return NextResponse.json({ error: 'Not a valid Beatport track URL' }, { status: 400 });

    const res = await fetch(
      `https://www.beatport.com/api/v4/catalog/tracks/${id}`,
      {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible)' },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return NextResponse.json({ error: `Beatport returned ${res.status}` }, { status: 502 });

    const data = await res.json() as BeatportTrack;

    return NextResponse.json({
      artist: data.artists?.[0]?.name ?? '',
      title: data.name ?? '',
      bpm: data.bpm ?? null,
      key: toCamelot(data.key),
      genre: data.genres?.[0]?.name ?? '',
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Lookup failed' }, { status: 500 });
  }
}
