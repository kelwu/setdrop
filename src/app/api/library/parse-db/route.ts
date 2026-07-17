import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { parseSeratoDatabase } from '@/lib/setdrop/serato-db-parser';
import { saveTracksToDatabase } from '@/lib/setdrop/library-save';

export const runtime = 'nodejs';
// Increased to handle large libraries: download + parse + batch-insert can take 30–60s
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { storagePath } = await request.json() as { storagePath?: string };
    if (!storagePath) return NextResponse.json({ error: 'storagePath required' }, { status: 400 });

    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: blob, error: dlError } = await admin.storage
      .from('library-uploads')
      .download(storagePath);

    if (dlError || !blob) {
      return NextResponse.json(
        { error: dlError?.message ?? 'Failed to download file from storage' },
        { status: 500 },
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const { tracks } = parseSeratoDatabase(buffer);

    // Clean up the temporary file (non-blocking)
    admin.storage.from('library-uploads').remove([storagePath]).catch(() => {});

    // Save to database server-side — no large JSON ever crosses the Vercel boundary
    const stats = await saveTracksToDatabase(user.id, tracks, 'serato');

    return NextResponse.json({
      count: stats.trackCount,
      stats: { added: stats.added, removed: stats.removed, unchanged: stats.unchanged },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[parse-db] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
