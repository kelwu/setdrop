import { createAdminClient } from '@/lib/supabase/server';

/**
 * Records one AI/usage event and reports whether the user is banned.
 *
 * Call at the top of every cost-incurring (AI) route, right after auth:
 *
 *   const { banned } = await recordUsage(user.id, 'analyze-gaps');
 *   if (banned) return NextResponse.json({ error: 'account_suspended' }, { status: 403 });
 *
 * It powers the admin cost dashboard and enforces bans. It manages its own
 * service-role client and NEVER throws — a logging/lookup failure must not
 * break the underlying request.
 *
 * @returns `{ banned, isBeta }` — reject with 403 when banned; skip rate
 *          limits when isBeta.
 */
export async function recordUsage(
  userId: string,
  endpoint: string,
): Promise<{ banned: boolean; isBeta: boolean }> {
  try {
    const admin = createAdminClient();
    const usagePromise = admin.from('api_usage').insert({ user_id: userId, endpoint });
    const { data } = await admin
      .from('users')
      .select('is_banned, is_beta')
      .eq('id', userId)
      .maybeSingle();
    await usagePromise;
    const row = data as { is_banned?: boolean; is_beta?: boolean } | null;
    return { banned: row?.is_banned === true, isBeta: row?.is_beta === true };
  } catch {
    return { banned: false, isBeta: false };
  }
}

/**
 * Counts how many times `endpoint` has been recorded for this user since the
 * start of the current (server-local) day. Used for the soft daily generation
 * cap. Uses the service-role client (api_usage is written server-side) and
 * never throws — a lookup failure returns 0 so it fails open.
 */
export async function usageToday(userId: string, endpoint: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count } = await admin
      .from('api_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gte('created_at', start.toISOString());
    return count ?? 0;
  } catch {
    return 0;
  }
}
