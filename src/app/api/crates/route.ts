import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: crates, error } = await admin
      .from('themed_crates')
      .select('id, name, prompt, tracks_json, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({
      crates: (crates ?? []).map(c => ({
        id: c.id,
        name: c.name,
        prompt: c.prompt,
        trackCount: Array.isArray(c.tracks_json) ? c.tracks_json.length : 0,
        tracks: c.tracks_json,
        createdAt: c.created_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[crates GET]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await req.json() as { id?: string };
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin
      .from('themed_crates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[crates DELETE]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
