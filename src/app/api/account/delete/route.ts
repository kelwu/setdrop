import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const uid = user.id;

  // Delete all user data in dependency order
  const { data: library } = await supabase
    .from('serato_libraries')
    .select('id')
    .eq('user_id', uid)
    .single();

  if (library) {
    await supabase.from('serato_tracks').delete().eq('library_id', library.id);
    await supabase.from('serato_crates').delete().eq('library_id', library.id);
    await supabase.from('serato_libraries').delete().eq('id', library.id);
  }

  await supabase.from('wishlist_tracks').delete().eq('user_id', uid);
  await supabase.from('gig_history').delete().eq('user_id', uid);
  await supabase.from('setlists').delete().eq('user_id', uid);
  await supabase.from('users').delete().eq('id', uid);

  // Delete auth user (requires service role)
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(uid);

  return NextResponse.json({ ok: true });
}
