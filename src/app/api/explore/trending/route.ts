import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const window = searchParams.get('window') ?? 'month'; // 'week' | 'month' | 'all'
    const genre = searchParams.get('genre') ?? '';

    const admin = createAdminClient();

    const cutoff = window === 'all'
      ? new Date(0).toISOString()
      : new Date(Date.now() - (window === 'week' ? 7 : 30) * 86400000).toISOString();

    let setsQuery = admin
      .from('setlists')
      .select('tracks_json, primary_genre')
      .eq('is_public', true)
      .gte('created_at', cutoff)
      .not('tracks_json', 'is', null);

    if (genre) setsQuery = setsQuery.eq('primary_genre', genre);

    const { data: rows, error } = await setsQuery;
    if (error) throw new Error(error.message);

    const countMap = new Map<string, { artist: string; title: string; count: number; genres: Set<string> }>();
    for (const set of rows ?? []) {
      const tracks = Array.isArray(set.tracks_json)
        ? set.tracks_json as Array<{ artist?: string; title?: string }>
        : [];
      for (const t of tracks) {
        if (!t.artist?.trim() || !t.title?.trim()) continue;
        const key = `${t.artist.toLowerCase()}|||${t.title.toLowerCase()}`;
        if (!countMap.has(key)) {
          countMap.set(key, { artist: t.artist, title: t.title, count: 0, genres: new Set() });
        }
        const entry = countMap.get(key)!;
        entry.count++;
        if (set.primary_genre) entry.genres.add(set.primary_genre);
      }
    }

    const trending = Array.from(countMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 25)
      .map(({ artist, title, count, genres }) => ({ artist, title, count, genres: Array.from(genres) }));

    return NextResponse.json({ trending });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[explore/trending]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
