import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface AdminSetlistRow {
  id: string;
  name: string;
  primaryGenre: string | null;
  crowdContext: string | null;
  durationMinutes: number | null;
  lineupSlot: string | null;
  isPublic: boolean;
  shareUrl: string | null;
  createdAt: string;
  trackCount: number;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  tier: 'free' | 'pro';
  isBeta: boolean;
  isBanned: boolean;
  libraryTracks: number;
  librarySource: 'serato' | 'rekordbox' | null;
  setlistCount: number;
  trackIdsThisMonth: number;
  sets: AdminSetlistRow[];
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

  const [authUsers, flagsRes, libsRes, setsRes, setTracksRes, tidsRes, aiCountRes] = await Promise.all([
    listAllAuthUsers(admin),
    admin.from('users').select('id, subscription_tier, is_beta, is_banned'),
    admin.from('serato_libraries').select('user_id, total_tracks, source'),
    admin.from('setlists').select('id, user_id, name, primary_genre, crowd_context, duration_minutes, lineup_slot, is_public, share_url, created_at'),
    admin.from('setlist_tracks').select('setlist_id'),
    admin.from('track_id_requests').select('user_id').gte('created_at', monthStart),
    admin.from('api_usage').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
  ]);

  type FlagRow = { id: string; subscription_tier: string | null; is_beta: boolean; is_banned: boolean };
  const flagsById = new Map<string, FlagRow>((flagsRes.data as FlagRow[] ?? []).map((f) => [f.id, f]));

  type LibRow = { user_id: string; total_tracks: number; source: string | null };
  const libByUser = new Map<string, LibRow>(
    (libsRes.data as LibRow[] ?? []).map((l) => [l.user_id, l]),
  );

  // Build setlist_id -> track count map
  type SetTrackRow = { setlist_id: string };
  const trackCountBySetlist = new Map<string, number>();
  for (const r of (setTracksRes.data as SetTrackRow[] ?? [])) {
    trackCountBySetlist.set(r.setlist_id, (trackCountBySetlist.get(r.setlist_id) ?? 0) + 1);
  }

  // Build user_id -> AdminSetlistRow[] map
  type SetRow = { id: string; user_id: string; name: string; primary_genre: string | null; crowd_context: string | null; duration_minutes: number | null; lineup_slot: string | null; is_public: boolean; share_url: string | null; created_at: string };
  const setsByUser = new Map<string, AdminSetlistRow[]>();
  for (const s of (setsRes.data as SetRow[] ?? [])) {
    const row: AdminSetlistRow = {
      id: s.id,
      name: s.name,
      primaryGenre: s.primary_genre,
      crowdContext: s.crowd_context,
      durationMinutes: s.duration_minutes,
      lineupSlot: s.lineup_slot,
      isPublic: s.is_public,
      shareUrl: s.share_url,
      createdAt: s.created_at,
      trackCount: trackCountBySetlist.get(s.id) ?? 0,
    };
    const list = setsByUser.get(s.user_id) ?? [];
    list.push(row);
    setsByUser.set(s.user_id, list);
  }

  const tidCountByUser = countBy((tidsRes.data as Array<{ user_id: string | null }>) ?? []);

  const users: AdminUserRow[] = authUsers
    .map((u) => {
      const f = flagsById.get(u.id);
      const lib = libByUser.get(u.id);
      const userSets = (setsByUser.get(u.id) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        id: u.id,
        email: u.email ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        tier: f?.subscription_tier === 'pro' ? 'pro' : 'free',
        isBeta: f?.is_beta === true,
        isBanned: f?.is_banned === true,
        libraryTracks: lib?.total_tracks ?? 0,
        librarySource: (lib?.source === 'rekordbox' ? 'rekordbox' : lib ? 'serato' : null),
        setlistCount: userSets.length,
        trackIdsThisMonth: tidCountByUser.get(u.id) ?? 0,
        sets: userSets,
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
