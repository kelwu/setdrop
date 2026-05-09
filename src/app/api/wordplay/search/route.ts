import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { jsonrepair } from 'jsonrepair';

export const maxDuration = 60;

interface TrackInput {
  id: string;
  artist: string;
  title: string;
  bpm: number;
  key: string;
}

export interface WordplayMatch {
  trackId: string;
  artist: string;
  title: string;
  lyricContext: string;
  position: 'hook' | 'chorus' | 'verse' | 'drop' | 'outro' | 'intro' | 'throughout';
}

export interface WordplayPair {
  fromId: string;
  fromArtist: string;
  fromTitle: string;
  fromBpm: number;
  toId: string;
  toArtist: string;
  toTitle: string;
  toBpm: number;
  bridge: string;
  bpmDiff: number;
  keysCompatible: boolean;
}

function camelotCompatible(k1: string, k2: string): boolean {
  const m1 = k1.match(/^(\d+)([AB])$/i);
  const m2 = k2.match(/^(\d+)([AB])$/i);
  if (!m1 || !m2) return false;
  const n1 = parseInt(m1[1]), l1 = m1[2].toUpperCase();
  const n2 = parseInt(m2[1]), l2 = m2[2].toUpperCase();
  if (n1 === n2) return true; // same number (parallel or identical)
  const diff = Math.abs(n1 - n2);
  return (diff === 1 || diff === 11) && l1 === l2; // adjacent on wheel
}

export async function POST(req: NextRequest) {
  try {
    const { word, tracks } = await req.json() as { word?: string; tracks?: TrackInput[] };
    if (!word?.trim()) return NextResponse.json({ error: 'Word is required' }, { status: 400 });
    if (!tracks?.length) return NextResponse.json({ matches: [], pairs: [] });

    // Limit to 150 tracks to keep token count manageable
    const sample = tracks.slice(0, 150);

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are a hip-hop DJ wordplay expert with deep knowledge of song lyrics.

Given the word/phrase "${word}", identify which tracks from this library prominently feature it in their lyrics — specifically in positions useful for a DJ transition: hook, chorus, drop, outro, or intro.

For each match, describe the specific lyrical context (quote the relevant line if you know it).
Then list the best pairs where one track could bridge into another through this word — describe the exact lyrical handoff.

Track list:
${JSON.stringify(sample.map(t => ({ id: t.id, artist: t.artist, title: t.title })), null, 2)}

Output ONLY valid JSON:
{
  "matches": [
    {
      "trackId": "...",
      "artist": "...",
      "title": "...",
      "lyricContext": "e.g. Features in hook: '...tonight we ride...'",
      "position": "hook|chorus|verse|drop|outro|intro|throughout"
    }
  ],
  "pairs": [
    {
      "fromId": "...",
      "fromArtist": "...",
      "fromTitle": "...",
      "toId": "...",
      "toArtist": "...",
      "toTitle": "...",
      "bridge": "e.g. 'Empire State' ends hook on '...tonight...' → 'God's Plan' opens 'Tonight we go hard'"
    }
  ]
}

Only include tracks you are genuinely confident feature this word in their lyrics. Do not guess. Pairs should only be formed from tracks already in the matches list.`;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content.find(b => b.type === 'text')?.text ?? '';
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    const raw = match ? match[1] : text;

    const result = JSON.parse(jsonrepair(raw.trim())) as {
      matches: Array<{ trackId: string; artist: string; title: string; lyricContext: string; position: WordplayMatch['position'] }>;
      pairs: Array<{ fromId: string; fromArtist: string; fromTitle: string; toId: string; toArtist: string; toTitle: string; bridge: string }>;
    };

    // Enrich pairs with BPM diff and key compatibility (computed, not guessed)
    const trackMap = new Map(sample.map(t => [t.id, t]));

    const enrichedPairs: WordplayPair[] = (result.pairs ?? []).map(p => {
      const from = trackMap.get(p.fromId);
      const to = trackMap.get(p.toId);
      return {
        ...p,
        fromBpm: from?.bpm ?? 0,
        toBpm: to?.bpm ?? 0,
        bpmDiff: from && to ? Math.abs(from.bpm - to.bpm) : 0,
        keysCompatible: from && to ? camelotCompatible(from.key, to.key) : false,
      };
    });

    return NextResponse.json({ matches: result.matches ?? [], pairs: enrichedPairs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    console.error('[wordplay/search]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
