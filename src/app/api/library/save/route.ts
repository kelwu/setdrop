import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { saveTracksToDatabase } from '@/lib/setdrop/library-save';
import type { LibraryTrack } from '@/lib/agents/types';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { tracks, source = 'serato' } = await req.json() as { tracks: LibraryTrack[]; source?: 'serato' | 'rekordbox' };
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
