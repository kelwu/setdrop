import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { LibraryTrack } from '@/lib/agents/types';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { tracks } = await req.json() as { tracks: LibraryTrack[] };
    if (!tracks?.length) return NextResponse.json({ error: 'No tracks provided' }, { status: 400 });

    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Deduplicate by artist+title (case-insensitive) — keep first occurrence
    const seen = new Set<string>();
    const dedupedTracks = tracks.filter(t => {
      const key = `${(t.artist ?? '').toLowerCase().trim()}|${(t.title ?? '').toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const { data: existing } = await admin
      .from('serato_libraries')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let libraryId: string;

    if (existing) {
      await admin.from('serato_libraries')
        .update({ total_tracks: dedupedTracks.length, last_synced: now })
        .eq('id', existing.id);
      await admin.from('serato_tracks').delete().eq('library_id', existing.id);
      libraryId = existing.id;
    } else {
      const { data, error } = await admin.from('serato_libraries')
        .insert({ user_id: user.id, total_tracks: dedupedTracks.length, last_synced: now, is_public: false })
        .select('id').single();
      if (error || !data) {
        return NextResponse.json({ error: error?.message ?? 'Failed to create library record' }, { status: 500 });
      }
      libraryId = data.id;
    }

    const BATCH = 500;
    for (let i = 0; i < dedupedTracks.length; i += BATCH) {
      const rows = dedupedTracks.slice(i, i + BATCH).map(t => ({
        library_id: libraryId,
        artist: t.artist || null,
        title: t.title || null,
        bpm: t.bpm || null,
        key: t.key || null,
        genre: t.genre || null,
        file_path: t.filePath || null,
        play_count: 0,
        in_library: true,
      }));
      const { error: insertError } = await admin.from('serato_tracks').insert(rows);
      if (insertError) {
        console.error('[save-library] Track insert error:', insertError.message);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, libraryId, trackCount: dedupedTracks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[save-library] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
