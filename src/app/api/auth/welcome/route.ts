import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loopsCreateContact, loopsSendEvent, updateLoopsContact } from '@/lib/email/loops';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isNewUser = user.created_at
    ? Date.now() - new Date(user.created_at).getTime() < 120_000
    : false;

  if (isNewUser) {
    loopsCreateContact(user.email); // non-blocking
    loopsSendEvent(user.email, 'signup');
    updateLoopsContact(user.email, {
      subscriptionTier: 'free',
      signedUpAt: new Date().toISOString().split('T')[0],
    });
  }

  return NextResponse.json({ ok: true });
}
