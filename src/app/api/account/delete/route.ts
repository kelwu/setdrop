import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const uid = user.id;
  const admin = createAdminClient();

  // Delete auth user FIRST — point of no return.
  // If this fails we return 500 and nothing has been touched; user can retry.
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(uid);
  if (authDeleteError) {
    console.error('[account/delete] Auth delete failed:', authDeleteError.message);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }

  // Best-effort data cleanup via admin client — session expiry no longer matters.
  // Auth user is already gone so we log errors but don't fail the response.
  try {
    const { data: library } = await admin
      .from('serato_libraries')
      .select('id')
      .eq('user_id', uid)
      .single();

    if (library) {
      await admin.from('serato_tracks').delete().eq('library_id', library.id);
      await admin.from('serato_crates').delete().eq('library_id', library.id);
      await admin.from('serato_libraries').delete().eq('id', library.id);
    }

    await admin.from('wishlist_tracks').delete().eq('user_id', uid);
    await admin.from('gig_history').delete().eq('user_id', uid);
    await admin.from('setlists').delete().eq('user_id', uid);
    await admin.from('users').delete().eq('id', uid);
  } catch (err) {
    console.error('[account/delete] Data cleanup error (auth already deleted):', err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true });
}
