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
    let isFirstSync = false;

    if (existing) {
      await admin.from('serato_libraries')
        .update({ total_tracks: dedupedTracks.length, last_synced: now })
        .eq('id', existing.id);
      libraryId = existing.id;
    } else {
      isFirstSync = true;
      const { data, error } = await admin.from('serato_libraries')
        .insert({ user_id: user.id, total_tracks: dedupedTracks.length, last_synced: now, is_public: false })
        .select('id').single();
      if (error || !data) {
        return NextResponse.json({ error: error?.message ?? 'Failed to create library record' }, { status: 500 });
      }
      libraryId = data.id;
    }

    const BATCH = 500;
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    if (isFirstSync) {
      // First upload — insert everything
      for (let i = 0; i < dedupedTracks.length; i += BATCH) {
        const rows = dedupedTracks.slice(i, i + BATCH).map(t => ({
          library_id: libraryId,
          artist: t.artist || null, title: t.title || null,
          bpm: t.bpm || null, key: t.key || null, genre: t.genre || null,
          file_path: t.filePath || null, play_count: 0, in_library: true,
        }));
        const { error: insertError } = await admin.from('serato_tracks').insert(rows);
        if (insertError) {
          console.error('[save-library] Track insert error:', insertError.message);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
      added = dedupedTracks.length;
    } else {
      // Re-sync — diff by file_path to preserve lastfm_tags and other enrichment
      const { data: existingTracks } = await admin
        .from('serato_tracks')
        .select('id, file_path')
        .eq('library_id', libraryId);

      const existingByPath = new Map(
        (existingTracks ?? []).filter(t => t.file_path).map(t => [t.file_path as string, t.id as string])
      );
      const newPaths = new Set(dedupedTracks.filter(t => t.filePath).map(t => t.filePath!));

      const toDeleteIds = (existingTracks ?? [])
        .filter(t => t.file_path && !newPaths.has(t.file_path as string))
        .map(t => t.id as string);

      // Insert new tracks FIRST — if this fails we abort before touching existing rows
      const toInsert = dedupedTracks
        .filter(t => !t.filePath || !existingByPath.has(t.filePath))
        .map(t => ({
          library_id: libraryId,
          artist: t.artist || null, title: t.title || null,
          bpm: t.bpm || null, key: t.key || null, genre: t.genre || null,
          file_path: t.filePath || null, play_count: 0, in_library: true,
        }));

      for (let i = 0; i < toInsert.length; i += BATCH) {
        const { error: insertError } = await admin.from('serato_tracks').insert(toInsert.slice(i, i + BATCH));
        if (insertError) {
          console.error('[save-library] Track insert error:', insertError.message);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
      added = toInsert.length;
      unchanged = dedupedTracks.length - toInsert.length;

      // Only delete after all inserts succeeded — library is never left in a broken state
      for (let i = 0; i < toDeleteIds.length; i += BATCH) {
        await admin.from('serato_tracks').delete().in('id', toDeleteIds.slice(i, i + BATCH));
      }
      removed = toDeleteIds.length;
    }

    return NextResponse.json({ ok: true, libraryId, trackCount: dedupedTracks.length, added, removed, unchanged });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[save-library] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
