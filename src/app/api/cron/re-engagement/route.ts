import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { loopsSendEvent } from '@/lib/email/loops';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff14d = new Date(Date.now() - 14 * 24 * 3_600_000).toISOString();
  const cutoff30d = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();

  // Users inactive for 14+ days who haven't been re-engaged in 30 days.
  // Uses last_sign_in_at from auth.users via the public users view.
  const { data: candidates } = await admin
    .from('users')
    .select('id, email, last_sign_in_at')
    .lt('last_sign_in_at', cutoff14d)
    .not('email', 'is', null);

  if (!candidates?.length) return NextResponse.json({ sent: 0 });

  // Filter out users who received a re-engagement email in the last 30 days.
  const { data: recentEmails } = await admin
    .from('re_engagement_log')
    .select('user_id')
    .gte('sent_at', cutoff30d);

  const recentlySent = new Set((recentEmails ?? []).map(r => r.user_id));
  const eligible = candidates.filter(u => !recentlySent.has(u.id) && u.email);

  let sent = 0;
  for (const user of eligible) {
    await loopsSendEvent(user.email!, 're_engagement');
    await admin.from('re_engagement_log').insert({ user_id: user.id, sent_at: new Date().toISOString() });
    sent++;
  }

  return NextResponse.json({ sent });
}
