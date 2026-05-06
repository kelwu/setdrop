import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

interface TrackInput {
  position: number;
  artist: string;
  title: string;
}

interface ResolvedTrack {
  position: number;
  beatportUrl?: string;
}

// Beatport's own frontend search API — returns real track page URLs
async function resolveBeatport(artist: string, title: string): Promise<string | undefined> {
  const q = encodeURIComponent(`${artist} ${title}`);
  try {
    const res = await fetch(
      `https://www.beatport.com/api/v4/catalog/search?q=${q}&type=tracks&per_page=5`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible)',
        },
        signal: AbortSignal.timeout(7000),
      }
    );
    if (!res.ok) return undefined;

    const data = await res.json() as {
      tracks?: {
        data?: Array<{
          url?: string;
          name?: string;
          artists?: Array<{ name: string }>;
        }>;
      };
    };

    const hits = data?.tracks?.data;
    if (!hits?.length) return undefined;

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const na = norm(artist);
    const nt = norm(title);

    const scored = hits.map(h => {
      const hArtists = (h.artists ?? []).map(a => norm(a.name));
      const hTitle = norm(h.name ?? '');
      const artistHit = hArtists.some(a => a.includes(na) || na.includes(a)) ? 2 : 0;
      const titleHit = (hTitle.includes(nt) || nt.includes(hTitle)) && nt.length > 2 ? 1 : 0;
      return { h, score: artistHit + titleHit };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    // Require at least artist match to trust the result
    if (best.score < 2 || !best.h.url) return undefined;

    return `https://www.beatport.com${best.h.url}`;
  } catch {
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  const { tracks } = await req.json() as { tracks: TrackInput[] };
  if (!Array.isArray(tracks) || !tracks.length) {
    return NextResponse.json({ resolved: [] });
  }

  const results = await Promise.allSettled(
    tracks.map(async (t): Promise<ResolvedTrack> => ({
      position: t.position,
      beatportUrl: await resolveBeatport(t.artist, t.title),
    }))
  );

  const resolved: ResolvedTrack[] = results
    .filter((r): r is PromiseFulfilledResult<ResolvedTrack> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(r => r.beatportUrl); // only return entries where we found something

  return NextResponse.json({ resolved });
}
