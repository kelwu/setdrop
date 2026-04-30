import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

async function fetchTags(artist: string, title: string, apiKey: string): Promise<string[]> {
  const params = new URLSearchParams({
    method: 'track.getTopTags',
    artist,
    track: title,
    api_key: apiKey,
    format: 'json',
    autocorrect: '1',
  });
  try {
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.error || !data.toptags?.tag) return [];
    const tags = Array.isArray(data.toptags.tag) ? data.toptags.tag : [data.toptags.tag];
    return tags
      .filter((t: { count: number }) => t.count > 0)
      .slice(0, 10)
      .map((t: { name: string }) => t.name.toLowerCase());
  } catch {
    return [];
  }
}

export async function POST() {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'LASTFM_API_KEY not configured' }, { status: 500 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: library } = await supabase
    .from('serato_libraries')
    .select('id')
    .eq('user_id', user.id)
    .single();

  let seratoEnriched = 0;

  if (library) {
    const { data: tracks } = await supabase
      .from('serato_tracks')
      .select('id, artist, title')
      .eq('library_id', library.id)
      .is('lastfm_tags', null)
      .limit(500);

    if (tracks?.length) {
      const BATCH = 5;
      for (let i = 0; i < tracks.length; i += BATCH) {
        const batch = tracks.slice(i, i + BATCH);
        await Promise.all(batch.map(async (t) => {
          if (!t.artist || !t.title) return;
          const tags = await fetchTags(t.artist, t.title, apiKey);
          await supabase.from('serato_tracks').update({ lastfm_tags: tags }).eq('id', t.id);
          seratoEnriched++;
        }));
        if (i + BATCH < tracks.length) await new Promise(r => setTimeout(r, 220));
      }
    }
  }

  // Enrich wishlist tracks
  const { data: wishlist } = await supabase
    .from('wishlist_tracks')
    .select('id, artist, title')
    .eq('user_id', user.id)
    .is('lastfm_tags', null);

  if (wishlist?.length) {
    const BATCH = 5;
    for (let i = 0; i < wishlist.length; i += BATCH) {
      const batch = wishlist.slice(i, i + BATCH);
      await Promise.all(batch.map(async (t) => {
        if (!t.artist || !t.title) return;
        const tags = await fetchTags(t.artist, t.title, apiKey);
        await supabase.from('wishlist_tracks').update({ lastfm_tags: tags }).eq('id', t.id);
      }));
      if (i + BATCH < wishlist.length) await new Promise(r => setTimeout(r, 220));
    }
  }

  return NextResponse.json({ enriched: seratoEnriched });
}
