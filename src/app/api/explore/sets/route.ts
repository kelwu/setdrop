import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const genre = searchParams.get('genre') ?? '';
    const slot = searchParams.get('slot') ?? '';
    const sort = searchParams.get('sort') ?? 'recent'; // 'recent' | 'popular'
    const page = parseInt(searchParams.get('page') ?? '0');
    const PAGE_SIZE = 12;

    const admin = createAdminClient();

    let query = admin
      .from('setlists')
      .select('id, name, primary_genre, secondary_genre, lineup_slot, duration_minutes, share_url, created_at, tracks_json, energy_arc')
      .eq('is_public', true)
      .not('share_url', 'is', null);

    if (genre) query = query.eq('primary_genre', genre);
    if (slot) query = query.eq('lineup_slot', slot);

    if (sort === 'popular') {
      // Sort by like count — join via subquery
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data: sets, error } = await query;
    if (error) throw new Error(error.message);

    // Get like counts for these sets
    const setIds = (sets ?? []).map(s => s.id);
    const { data: likeCounts } = await admin
      .from('set_likes')
      .select('setlist_id')
      .in('setlist_id', setIds.length ? setIds : ['00000000-0000-0000-0000-000000000000']);

    const likeMap = new Map<string, number>();
    for (const row of likeCounts ?? []) {
      likeMap.set(row.setlist_id, (likeMap.get(row.setlist_id) ?? 0) + 1);
    }

    // Get viewer's likes if authenticated
    let myLikes = new Set<string>();
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && setIds.length) {
        const { data: mine } = await admin
          .from('set_likes')
          .select('setlist_id')
          .eq('user_id', user.id)
          .in('setlist_id', setIds);
        myLikes = new Set((mine ?? []).map(r => r.setlist_id));
      }
    } catch { /* unauthenticated — ok */ }

    const result = (sets ?? []).map(s => {
      const tracks = Array.isArray(s.tracks_json) ? s.tracks_json as Array<{ energyLevel?: number; artist?: string; title?: string }> : [];
      const energyPoints = tracks.map(t => t.energyLevel ?? 5);
      return {
        id: s.id,
        name: s.name,
        primaryGenre: s.primary_genre,
        secondaryGenre: s.secondary_genre,
        lineupSlot: s.lineup_slot,
        durationMinutes: s.duration_minutes,
        shareSlug: s.share_url,
        createdAt: s.created_at,
        trackCount: tracks.length,
        energyPoints,
        likes: likeMap.get(s.id) ?? 0,
        liked: myLikes.has(s.id),
      };
    });

    // Sort popular by likes after enrichment
    if (sort === 'popular') result.sort((a, b) => b.likes - a.likes);

    return NextResponse.json({ sets: result, hasMore: result.length === PAGE_SIZE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[explore/sets]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
