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
  /** Most recent *meaningful* action: set / library import / crate / track-id / AI call. */
  lastActiveAt: string | null;
  tier: 'free' | 'pro';
  isBeta: boolean;
  isBanned: boolean;
  libraryTracks: number;
  librarySource: 'serato' | 'rekordbox' | null;
  librarySyncedAt: string | null;
  setlistCount: number;
  trackIdsThisMonth: number;
  sets: AdminSetlistRow[];
}

export interface AdminActivityRow {
  kind: 'set' | 'library' | 'crate';
  email: string | null;
  detail: string;
  at: string;
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
  recentActivity: AdminActivityRow[];
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

/** Largest non-null ISO string, or null. Lexical compare is valid for ISO-8601. */
function maxIso(...vals: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const v of vals) if (v && (!best || v > best)) best = v;
  return best;
}

export async function getAdminData(): Promise<AdminData> {
  const admin = createAdminClient();
  const now = Date.now();
  const dayAgoIso = new Date(now - 24 * 3_600_000).toISOString();
  const sevenDaysAgo = now - 7 * 86_400_000;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const [authUsers, flagsRes, libsRes, setsRes, tidsRes, cratesRes, apiRecentRes, aiCountRes] = await Promise.all([
    listAllAuthUsers(admin),
    admin.from('users').select('id, subscription_tier, is_beta, is_banned'),
    admin.from('serato_libraries').select('user_id, total_tracks, source, last_synced'),
    admin.from('setlists').select('id, user_id, name, primary_genre, crowd_context, duration_minutes, lineup_slot, is_public, share_url, created_at, tracks_json'),
    admin.from('track_id_requests').select('user_id, created_at'),
    admin.from('themed_crates').select('user_id, name, created_at'),
    // Bounded — PostgREST caps at 1000 anyway; most-recent rows are all we need for "last active".
    admin.from('api_usage').select('user_id, created_at').order('created_at', { ascending: false }).limit(1000),
    admin.from('api_usage').select('id', { count: 'exact', head: true }).gte('created_at', dayAgoIso),
  ]);

  const emailById = new Map<string, string | null>(authUsers.map((u) => [u.id, u.email ?? null]));

  type FlagRow = { id: string; subscription_tier: string | null; is_beta: boolean; is_banned: boolean };
  const flagsById = new Map<string, FlagRow>((flagsRes.data as FlagRow[] ?? []).map((f) => [f.id, f]));

  // Libraries — a user may have more than one (Serato + Rekordbox, or a re-import).
  // Aggregate instead of letting a Map-key collision silently drop all but the last.
  type LibRow = { user_id: string; total_tracks: number | null; source: string | null; last_synced: string | null };
  const libByUser = new Map<string, { tracks: number; source: string | null; syncedAt: string | null }>();
  for (const l of (libsRes.data as LibRow[] ?? [])) {
    if (!l.user_id) continue;
    const cur = libByUser.get(l.user_id) ?? { tracks: 0, source: null, syncedAt: null };
    cur.tracks += l.total_tracks ?? 0;
    // source + syncedAt follow the most recently synced library
    if (l.last_synced && (!cur.syncedAt || l.last_synced > cur.syncedAt)) {
      cur.syncedAt = l.last_synced;
      cur.source = l.source ?? cur.source;
    } else if (!cur.source) {
      cur.source = l.source ?? null;
    }
    libByUser.set(l.user_id, cur);
  }

  // Setlists — track count comes from tracks_json (the source of truth), NOT the
  // setlist_tracks junction, which is unused and always empty (every count was 0).
  type SetRow = { id: string; user_id: string; name: string; primary_genre: string | null; crowd_context: string | null; duration_minutes: number | null; lineup_slot: string | null; is_public: boolean; share_url: string | null; created_at: string; tracks_json: unknown };
  const setRows = (setsRes.data as SetRow[] ?? []);
  const setsByUser = new Map<string, AdminSetlistRow[]>();
  for (const s of setRows) {
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
      trackCount: Array.isArray(s.tracks_json) ? s.tracks_json.length : 0,
    };
    const list = setsByUser.get(s.user_id) ?? [];
    list.push(row);
    setsByUser.set(s.user_id, list);
  }

  // Track ID requests — keep timestamps for both the "this month" count and last-active.
  type TidRow = { user_id: string | null; created_at: string };
  const tidTimesByUser = new Map<string, string[]>();
  for (const t of (tidsRes.data as TidRow[] ?? [])) {
    if (!t.user_id) continue;
    const list = tidTimesByUser.get(t.user_id) ?? [];
    list.push(t.created_at);
    tidTimesByUser.set(t.user_id, list);
  }

  // Themed crates — latest per user (for last-active) + rows for the recent feed.
  type CrateRow = { user_id: string | null; name: string; created_at: string };
  const crateRows = (cratesRes.data as CrateRow[] ?? []);
  const crateLatestByUser = new Map<string, string>();
  for (const c of crateRows) {
    if (!c.user_id) continue;
    const prev = crateLatestByUser.get(c.user_id);
    if (!prev || c.created_at > prev) crateLatestByUser.set(c.user_id, c.created_at);
  }

  // api_usage — max timestamp per user (the truest "did something" signal).
  type ApiRow = { user_id: string | null; created_at: string };
  const apiLatestByUser = new Map<string, string>();
  for (const a of (apiRecentRes.data as ApiRow[] ?? [])) {
    if (!a.user_id) continue;
    const prev = apiLatestByUser.get(a.user_id);
    if (!prev || a.created_at > prev) apiLatestByUser.set(a.user_id, a.created_at);
  }

  const users: AdminUserRow[] = authUsers
    .map((u) => {
      const f = flagsById.get(u.id);
      const lib = libByUser.get(u.id);
      const userSets = (setsByUser.get(u.id) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const tidTimes = tidTimesByUser.get(u.id) ?? [];
      const trackIdsThisMonth = tidTimes.filter((ts) => new Date(ts).getTime() >= monthStart).length;
      const latestTid = tidTimes.reduce<string | null>((m, ts) => (!m || ts > m ? ts : m), null);
      const lastActiveAt = maxIso(
        userSets[0]?.createdAt,
        lib?.syncedAt,
        crateLatestByUser.get(u.id),
        latestTid,
        apiLatestByUser.get(u.id),
      );
      return {
        id: u.id,
        email: u.email ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        lastActiveAt,
        tier: f?.subscription_tier === 'pro' ? 'pro' : 'free',
        isBeta: f?.is_beta === true,
        isBanned: f?.is_banned === true,
        libraryTracks: lib?.tracks ?? 0,
        librarySource: (lib?.source === 'rekordbox' ? 'rekordbox' : lib ? 'serato' : null),
        librarySyncedAt: lib?.syncedAt ?? null,
        setlistCount: userSets.length,
        trackIdsThisMonth,
        sets: userSets,
      } as AdminUserRow;
    })
    .sort((a, b) => {
      // Most recently active first; users who've never done anything sink to the bottom.
      const av = a.lastActiveAt ?? '';
      const bv = b.lastActiveAt ?? '';
      if (av && bv) return bv.localeCompare(av);
      if (av) return -1;
      if (bv) return 1;
      return a.createdAt < b.createdAt ? 1 : -1; // both inactive → newest signup first
    });

  // Recent activity feed — the "is anything happening right now" glance, across all users.
  const recentActivity: AdminActivityRow[] = [];
  for (const s of setRows) {
    recentActivity.push({ kind: 'set', email: emailById.get(s.user_id) ?? null, detail: s.name || 'Untitled set', at: s.created_at });
  }
  for (const l of (libsRes.data as LibRow[] ?? [])) {
    if (!l.last_synced || !l.user_id) continue;
    recentActivity.push({ kind: 'library', email: emailById.get(l.user_id) ?? null, detail: `${l.source ?? 'library'} · ${(l.total_tracks ?? 0).toLocaleString()} tracks`, at: l.last_synced });
  }
  for (const c of crateRows) {
    if (!c.user_id) continue;
    recentActivity.push({ kind: 'crate', email: emailById.get(c.user_id) ?? null, detail: c.name || 'Untitled crate', at: c.created_at });
  }
  recentActivity.sort((a, b) => b.at.localeCompare(a.at));

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

  return { metrics, users, recentActivity: recentActivity.slice(0, 12) };
}
