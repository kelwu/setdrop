import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import type { LibraryTrack } from '@/lib/agents/types';

const BATCH = 500;

export interface SaveStats {
  libraryId: string;
  trackCount: number;
  added: number;
  removed: number;
  unchanged: number;
}

export async function saveTracksToDatabase(
  userId: string,
  tracks: LibraryTrack[],
  source: 'serato' | 'rekordbox',
): Promise<SaveStats> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const seen = new Set<string>();
  const deduped = tracks.filter(t => {
    const key = `${(t.artist ?? '').toLowerCase().trim()}|${(t.title ?? '').toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const { data: existing } = await admin
    .from('serato_libraries')
    .select('id')
    .eq('user_id', userId)
    .single();

  let libraryId: string;
  let isFirstSync = false;

  if (existing) {
    await admin.from('serato_libraries')
      .update({ total_tracks: deduped.length, last_synced: now, source })
      .eq('id', existing.id);
    libraryId = existing.id;
  } else {
    isFirstSync = true;
    const { data, error } = await admin.from('serato_libraries')
      .insert({ user_id: userId, total_tracks: deduped.length, last_synced: now, is_public: false, source })
      .select('id').single();
    if (error || !data) throw new Error(error?.message ?? 'Failed to create library record');
    libraryId = data.id;
  }

  let added = 0;
  let removed = 0;
  let unchanged = 0;

  if (isFirstSync) {
    for (let i = 0; i < deduped.length; i += BATCH) {
      const rows = deduped.slice(i, i + BATCH).map(t => ({
        library_id: libraryId,
        artist: t.artist || null, title: t.title || null,
        bpm: t.bpm || null, key: t.key || null, genre: t.genre || null,
        year: t.year || null, file_path: t.filePath || null,
        play_count: 0, in_library: true,
      }));
      const { error } = await admin.from('serato_tracks').insert(rows);
      if (error) throw new Error(error.message);
    }
    added = deduped.length;
  } else {
    const { data: existingTracks } = await admin
      .from('serato_tracks')
      .select('id, file_path')
      .eq('library_id', libraryId);

    const existingByPath = new Map(
      (existingTracks ?? []).filter(t => t.file_path).map(t => [t.file_path as string, t.id as string]),
    );
    const newPaths = new Set(deduped.filter(t => t.filePath).map(t => t.filePath!));

    const toDeleteIds = (existingTracks ?? [])
      .filter(t => t.file_path && !newPaths.has(t.file_path as string))
      .map(t => t.id as string);

    const toInsert = deduped
      .filter(t => !t.filePath || !existingByPath.has(t.filePath))
      .map(t => ({
        library_id: libraryId,
        artist: t.artist || null, title: t.title || null,
        bpm: t.bpm || null, key: t.key || null, genre: t.genre || null,
        year: t.year || null, file_path: t.filePath || null,
        play_count: 0, in_library: true,
      }));

    for (let i = 0; i < toInsert.length; i += BATCH) {
      const { error } = await admin.from('serato_tracks').insert(toInsert.slice(i, i + BATCH));
      if (error) throw new Error(error.message);
    }
    added = toInsert.length;
    unchanged = deduped.length - toInsert.length;

    for (let i = 0; i < toDeleteIds.length; i += BATCH) {
      await admin.from('serato_tracks').delete().in('id', toDeleteIds.slice(i, i + BATCH));
    }
    removed = toDeleteIds.length;
  }

  return { libraryId, trackCount: deduped.length, added, removed, unchanged };
}
