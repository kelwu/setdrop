import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { parseSeratoDatabase } from '@/lib/setdrop/serato-db-parser';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storagePath } = await request.json() as { storagePath?: string };
    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath required' }, { status: 400 });
    }

    // Ensure the path belongs to this user (format: userId/uuid.db)
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

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { tracks, count } = parseSeratoDatabase(buffer);

    // Clean up the temporary file after successful parse
    admin.storage.from('library-uploads').remove([storagePath]).catch(() => {});

    return NextResponse.json({ tracks, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[parse-db] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
