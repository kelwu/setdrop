import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import type { LibraryTrack } from '@/lib/agents/types';
import { trackKey, type RekordboxPlaylist } from './rekordbox-parser';

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
  playlists?: RekordboxPlaylist[],
): Promise<SaveStats> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const seen = new Set<string>();
  const deduped = tracks.filter(t => {
    const key = trackKey(t.artist ?? '', t.title ?? '');
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

  // Maps each track's canonical key → its freshly-inserted serato_tracks UUID, so
  // Rekordbox playlist membership can be persisted as real row ids (clean joins at
  // generation time, no fragile string matching).
  const keyToId = new Map<string, string>();
  const rowFor = (t: LibraryTrack) => ({
    library_id: libraryId,
    artist: t.artist || null, title: t.title || null,
    bpm: t.bpm || null, key: t.key || null, genre: t.genre || null,
    year: t.year || null, file_path: t.filePath || null,
    play_count: 0, in_library: true,
  });
  const insertBatch = async (batch: LibraryTrack[]) => {
    const { data, error } = await admin
      .from('serato_tracks')
      .insert(batch.map(rowFor))
      .select('id, artist, title');
    if (error) throw new Error(error.message);
    for (const r of data ?? []) keyToId.set(trackKey(r.artist ?? '', r.title ?? ''), r.id);
  };

  if (!isFirstSync) {
    // Delete all existing tracks then re-insert the full deduped set.
    // Simpler than diffing and avoids the Supabase 1000-row default page cap
    // that would corrupt the diff when libraries exceed 1000 tracks.
    const { error: delError } = await admin
      .from('serato_tracks')
      .delete()
      .eq('library_id', libraryId);
    if (delError) throw new Error(delError.message);
    // Re-inserting renumbers every track UUID, invalidating any crate's track_ids.
    // Drop stale crates now; they're rebuilt below when playlists are supplied.
    await admin.from('serato_crates').delete().eq('library_id', libraryId);
  }

  for (let i = 0; i < deduped.length; i += BATCH) {
    await insertBatch(deduped.slice(i, i + BATCH));
  }
  added = deduped.length;

  // Persist Rekordbox playlists as crates keyed on real track UUIDs. Only touch
  // crates when playlists are supplied, so a Serato re-sync never wipes them.
  if (playlists?.length) {
    await admin.from('serato_crates').delete().eq('library_id', libraryId);
    const crateRows = playlists
      .map(p => {
        const ids = p.trackKeys.map(k => keyToId.get(k)).filter((id): id is string => !!id);
        return { library_id: libraryId, crate_name: p.name, track_count: ids.length, track_ids: ids };
      })
      .filter(c => c.track_ids.length > 0);
    for (let i = 0; i < crateRows.length; i += BATCH) {
      const { error } = await admin.from('serato_crates').insert(crateRows.slice(i, i + BATCH));
      if (error) throw new Error(error.message);
    }
  }

  return { libraryId, trackCount: deduped.length, added, removed, unchanged };
}
