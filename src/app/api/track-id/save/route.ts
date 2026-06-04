import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { AcrCloudMatch } from '@/lib/setdrop/acrcloud';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { requestId, candidate } = await req.json() as { requestId: string | null; candidate: AcrCloudMatch };
    if (!candidate?.artist || !candidate?.title) {
      return NextResponse.json({ error: 'candidate required' }, { status: 400 });
    }

    const q = encodeURIComponent(`${candidate.artist} ${candidate.title}`);

    const { data: inserted, error } = await supabase
      .from('wishlist_tracks')
      .insert({
        user_id: user.id,
        artist: candidate.artist,
        title: candidate.title,
        bpm: candidate.bpm ?? null,
        status: 'wishlist',
        enrichment_source: 'track_id',
        beatport_search_url: candidate.beatportSearchUrl,
        bpm_supreme_search_url: `https://www.bpmsupreme.com/search?q=${q}`,
        traxsource_search_url: `https://www.traxsource.com/search?term=${q}`,
        djcity_search_url: `https://www.djcity.com/search?q=${q}`,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Mark request as converted
    if (requestId && inserted) {
      const admin = createAdminClient();
      await admin
        .from('track_id_requests')
        .update({ added_to_wishlist: true, added_wishlist_id: inserted.id })
        .eq('id', requestId)
        .eq('user_id', user.id);
    }

    return NextResponse.json({ ok: true, wishlistId: inserted?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[track-id/save]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
