import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { jsonrepair } from 'jsonrepair';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

const MODEL = 'claude-sonnet-4-6';

async function lookupBpmKey(
  tracks: Array<{ id: string; artist: string; title: string }>,
): Promise<Array<{ id: string; bpm: number | null; key: string | null }>> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const list = tracks.map((t, i) => `${i + 1}. "${t.title}" by ${t.artist}`).join('\n');

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `For each track, provide the BPM (beats per minute, as a number) and musical key in Camelot Wheel notation (e.g. "8A", "11B"). Use your knowledge — give your best estimate even if uncertain. Do not leave fields null.

Tracks:
${list}

Return ONLY a JSON array with one object per track in order:
[{"bpm": 128, "key": "8A"}, {"bpm": 95, "key": "2B"}, ...]`,
    }],
  });

  const text = msg.content.find(b => b.type === 'text')?.text ?? '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return tracks.map(t => ({ id: t.id, bpm: null, key: null }));

  try {
    const results = JSON.parse(jsonrepair(match[0])) as Array<{ bpm: number; key: string }>;
    return tracks.map((t, i) => ({
      id: t.id,
      bpm: typeof results[i]?.bpm === 'number' ? results[i].bpm : null,
      key: typeof results[i]?.key === 'string' ? results[i].key : null,
    }));
  } catch {
    return tracks.map(t => ({ id: t.id, bpm: null, key: null }));
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tracks } = await supabase
    .from('wishlist_tracks')
    .select('id, artist, title, bpm, key')
    .eq('user_id', user.id)
    .or('bpm.is.null,key.is.null');

  const toEnrich = (tracks ?? []).filter(t => !t.bpm || !t.key);
  if (!toEnrich.length) return NextResponse.json({ enriched: 0 });

  const BATCH = 10;
  let enriched = 0;

  for (let i = 0; i < toEnrich.length; i += BATCH) {
    const batch = toEnrich.slice(i, i + BATCH);
    const results = await lookupBpmKey(
      batch.map(t => ({ id: t.id, artist: t.artist ?? '', title: t.title ?? '' })),
    );

    await Promise.all(results.map(async (r) => {
      const orig = batch.find(t => t.id === r.id);
      if (!orig) return;
      const update: Record<string, number | string> = {};
      if (r.bpm !== null && !orig.bpm) update.bpm = r.bpm;
      if (r.key !== null && !orig.key) update.key = r.key;
      if (Object.keys(update).length) {
        await supabase.from('wishlist_tracks').update(update).eq('id', r.id);
        enriched++;
      }
    }));
  }

  return NextResponse.json({ enriched });
}
