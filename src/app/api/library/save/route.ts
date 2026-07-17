import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { saveTracksToDatabase } from '@/lib/setdrop/library-save';
import type { LibraryTrack } from '@/lib/agents/types';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json() as
      | { tracks: LibraryTrack[]; source?: 'serato' | 'rekordbox' }
      | { storagePath: string; source?: 'serato' | 'rekordbox' };

    const source = body.source ?? 'serato';
    let tracks: LibraryTrack[];

    if ('storagePath' in body && body.storagePath) {
      if (!body.storagePath.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const admin = createAdminClient();
      const { data: blob, error: dlError } = await admin.storage
        .from('library-uploads')
        .download(body.storagePath);
      if (dlError || !blob) {
        return NextResponse.json({ error: dlError?.message ?? 'Failed to download tracks' }, { status: 500 });
      }
      tracks = JSON.parse(await blob.text()) as LibraryTrack[];
      admin.storage.from('library-uploads').remove([body.storagePath]).catch(() => {});
    } else if ('tracks' in body) {
      tracks = body.tracks;
    } else {
      return NextResponse.json({ error: 'No tracks or storagePath provided' }, { status: 400 });
    }

    if (!tracks?.length) return NextResponse.json({ error: 'No tracks provided' }, { status: 400 });

    const stats = await saveTracksToDatabase(user.id, tracks, source);

    return NextResponse.json({
      ok: true,
      libraryId: stats.libraryId,
      trackCount: stats.trackCount,
      added: stats.added,
      removed: stats.removed,
      unchanged: stats.unchanged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[save-library] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
