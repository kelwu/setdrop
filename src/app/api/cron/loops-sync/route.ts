import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { updateLoopsContact } from '@/lib/email/loops';

// Weekly self-heal: re-sync every user's Loops segmentation properties from
// Supabase (the source of truth). The per-action routes (auth, library/save,
// setlist/notify, Stripe webhook) already keep Loops current in real time — this
// only catches drift (missed webhooks, contacts created before the key was live,
// manual DB edits). It upserts contact PROPERTIES only and sends no events, so it
// can never trigger a campaign/email. Mirrors the derivation the live routes use:
//   subscriptionTier ← users.subscription_tier   (Stripe webhook keeps this fresh)
//   signedUpAt       ← users.created_at (YYYY-MM-DD)
//   libraryImported  ← has a serato_libraries row
//   setlistsGenerated← all-time count of the user's setlists
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const [{ data: users }, { data: libraries }, { data: setlists }] = await Promise.all([
    admin.from('users').select('id, email, created_at, subscription_tier'),
    admin.from('serato_libraries').select('user_id'),
    admin.from('setlists').select('user_id'),
  ]);

  const importedUserIds = new Set((libraries ?? []).map(l => l.user_id));
  const setlistCounts = new Map<string, number>();
  for (const s of setlists ?? []) {
    setlistCounts.set(s.user_id, (setlistCounts.get(s.user_id) ?? 0) + 1);
  }

  const targets = (users ?? []).filter(u => u.email);

  // Upsert in small parallel chunks so a growing user base stays well inside
  // maxDuration without hammering Loops' rate limit all at once.
  let synced = 0;
  const CHUNK = 10;
  for (let i = 0; i < targets.length; i += CHUNK) {
    const chunk = targets.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(u =>
        updateLoopsContact(u.email!, {
          subscriptionTier: u.subscription_tier ?? 'free',
          signedUpAt: new Date(u.created_at).toISOString().split('T')[0],
          libraryImported: importedUserIds.has(u.id),
          setlistsGenerated: setlistCounts.get(u.id) ?? 0,
        }),
      ),
    );
    synced += chunk.length;
  }

  return NextResponse.json({ synced, skippedNoEmail: (users ?? []).length - targets.length });
}
