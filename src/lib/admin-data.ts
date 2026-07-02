import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface AdminUserRow {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  tier: 'free' | 'pro';
  isBeta: boolean;
  isBanned: boolean;
  libraryTracks: number;
  setlistCount: number;
  trackIdsThisMonth: number;
}

export interface AdminMetrics {
  totalUsers: number;
  newUsers7d: number;
  proCount: number;
  mrr: number;
  aiCalls24h: number;
  signups14d: { date: string; count: number }[];
}

export interface AdminData {
  metrics: AdminMetrics;
  users: AdminUserRow[];
}

function countBy(rows: Array<{ user_id: string | null }>): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.user_id) continue;
    m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
  }
  return m;
}

/** Bucket ISO timestamps into the last `days` calendar days (UTC), oldest first. */
function buildDailyBuckets(timestamps: string[], days: number): { date: string; count: number }[] {
  const buckets = new Map<string, number>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const ts of timestamps) {
    const key = ts.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

async function listAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const all: User[] = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    all.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return all;
}

export async function getAdminData(): Promise<AdminData> {
  const admin = createAdminClient();
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 3_600_000).toISOString();
  const sevenDaysAgo = now - 7 * 86_400_000;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [authUsers, flagsRes, libsRes, setsRes, tidsRes, aiCountRes] = await Promise.all([
    listAllAuthUsers(admin),
    admin.from('users').select('id, subscription_tier, is_beta, is_banned'),
    admin.from('serato_libraries').select('user_id, total_tracks'),
    admin.from('setlists').select('user_id'),
    admin.from('track_id_requests').select('user_id').gte('created_at', monthStart),
    admin.from('api_usage').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
  ]);

  type FlagRow = { id: string; subscription_tier: string | null; is_beta: boolean; is_banned: boolean };
  const flagsById = new Map<string, FlagRow>((flagsRes.data as FlagRow[] ?? []).map((f) => [f.id, f]));
  const libByUser = new Map<string, number>(
    (libsRes.data as Array<{ user_id: string; total_tracks: number }> ?? []).map((l) => [l.user_id, l.total_tracks]),
  );
  const setCountByUser = countBy((setsRes.data as Array<{ user_id: string | null }>) ?? []);
  const tidCountByUser = countBy((tidsRes.data as Array<{ user_id: string | null }>) ?? []);

  const users: AdminUserRow[] = authUsers
    .map((u) => {
      const f = flagsById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        tier: f?.subscription_tier === 'pro' ? 'pro' : 'free',
        isBeta: f?.is_beta === true,
        isBanned: f?.is_banned === true,
        libraryTracks: libByUser.get(u.id) ?? 0,
        setlistCount: setCountByUser.get(u.id) ?? 0,
        trackIdsThisMonth: tidCountByUser.get(u.id) ?? 0,
      } as AdminUserRow;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // newest first

  const proCount = users.filter((u) => u.tier === 'pro').length;
  const newUsers7d = users.filter((u) => new Date(u.createdAt).getTime() >= sevenDaysAgo).length;

  const metrics: AdminMetrics = {
    totalUsers: users.length,
    newUsers7d,
    proCount,
    mrr: proCount * 12,
    aiCalls24h: aiCountRes.count ?? 0,
    signups14d: buildDailyBuckets(users.map((u) => u.createdAt), 14),
  };

  return { metrics, users };
}
