import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { setlistId } = await req.json() as { setlistId: string };
    if (!setlistId) return NextResponse.json({ error: 'setlistId required' }, { status: 400 });

    const admin = createAdminClient();

    // Check if already liked
    const { data: existing } = await admin
      .from('set_likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('setlist_id', setlistId)
      .single();

    if (existing) {
      await admin.from('set_likes').delete().eq('id', existing.id);
    } else {
      // ON CONFLICT DO NOTHING handles the race condition if two requests arrive simultaneously
      await admin.from('set_likes').upsert(
        { user_id: user.id, setlist_id: setlistId },
        { onConflict: 'user_id,setlist_id', ignoreDuplicates: true },
      );
    }

    // Return updated count
    const { count } = await admin
      .from('set_likes')
      .select('*', { count: 'exact', head: true })
      .eq('setlist_id', setlistId);

    return NextResponse.json({ liked: !existing, count: count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[explore/like]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
