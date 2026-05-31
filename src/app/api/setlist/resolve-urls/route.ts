import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

interface TrackInput {
  position: number;
  artist: string;
  title: string;
  isWishlist?: boolean;
}

interface ResolvedTrack {
  position: number;
  beatportUrl?: string;
  bpmSupremeUrl?: string;
  bpmSupremeFound?: boolean;
  traxsourceUrl?: string;
  traxsourceFound?: boolean;
  djcityUrl?: string;
  djcityFound?: boolean;
}

function anthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
    if (best.score < 2 || !best.h.url) return undefined;

    return `https://www.beatport.com${best.h.url}`;
  } catch {
    return undefined;
  }
}

// Web search verification for pools without public APIs
async function searchPool(
  artist: string,
  title: string,
  domain: string,
): Promise<{ url?: string; found: boolean }> {
  try {
    const msg = await anthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [{ role: 'user', content: `"${artist}" "${title}"` }],
      tools: [{
        type: 'web_search_20260209',
        name: 'web_search',
        max_uses: 1,
        allowed_domains: [domain],
      } as Anthropic.Messages.WebSearchTool20260209],
      tool_choice: { type: 'any' },
    });

    for (const block of msg.content) {
      if (block.type === 'web_search_tool_result') {
        const content = (block as Anthropic.Messages.WebSearchToolResultBlock).content;
        if (Array.isArray(content) && content.length > 0) {
          return { url: content[0].url, found: true };
        }
      }
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

export async function POST(req: NextRequest) {
  const { tracks } = await req.json() as { tracks: TrackInput[] };
  if (!Array.isArray(tracks) || !tracks.length) {
    return NextResponse.json({ resolved: [] });
  }

  const results = await Promise.allSettled(
    tracks.map(async (t): Promise<ResolvedTrack> => {
      const resolved: ResolvedTrack = { position: t.position };

      resolved.beatportUrl = await resolveBeatport(t.artist, t.title);

      if (t.isWishlist) {
        const [bpm, trax, djc] = await Promise.all([
          searchPool(t.artist, t.title, 'www.bpmsupreme.com'),
          searchPool(t.artist, t.title, 'www.traxsource.com'),
          searchPool(t.artist, t.title, 'www.djcity.com'),
        ]);
        resolved.bpmSupremeUrl = bpm.url;
        resolved.bpmSupremeFound = bpm.found;
        resolved.traxsourceUrl = trax.url;
        resolved.traxsourceFound = trax.found;
        resolved.djcityUrl = djc.url;
        resolved.djcityFound = djc.found;
      }

      return resolved;
    })
  );

  const resolved: ResolvedTrack[] = results
    .filter((r): r is PromiseFulfilledResult<ResolvedTrack> => r.status === 'fulfilled')
    .map(r => r.value);

  return NextResponse.json({ resolved });
}
