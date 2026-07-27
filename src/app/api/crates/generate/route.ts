import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recordUsage } from '@/lib/api-usage';
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropic } from '@/lib/anthropic';
import type { CrateTrack } from '@/lib/crates/types';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';
// Default crate size when the client doesn't request a specific count. Keeps a
// broad prompt (e.g. a genre with hundreds of matches) from producing an
// unusable, uncurated crate. A client sending targetCount: 0 means "no cap".
const DEFAULT_CRATE_SIZE = 50;
// Below this many genre matches we still return the crate but flag it, so the
// user knows the genre barely matched rather than silently getting a thin/odd set.
const GENRE_MATCH_WARN_FLOOR = 8;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawTrack {
  id: string;
  artist: string | null;
  title: string | null;
  bpm: number | null;
  key: string | null;
  genre: string | null;
  year: number | null;
  file_path: string | null;
  lastfm_tags: string[] | null;
}

interface CrateProfile {
  crateName: string;
  genreKeywords: string[];
  bpmMin: number;
  bpmMax: number;
  targetEnergy: 'warmup' | 'build' | 'peak' | 'mixed';
  sortOrder: 'asc' | 'desc' | 'energy_arc';
  moodNotes: string;
  // Set only when the prompt names a track count (e.g. "30-track warmup"). Used
  // when the UI leaves size on "Auto"; an explicit UI size always overrides it.
  targetCount?: number | null;
}

// ─── AI tool ──────────────────────────────────────────────────────────────────

const PROFILE_TOOL: Anthropic.Tool = {
  name: 'parse_crate_prompt',
  description: 'Parse a DJ crate prompt into a structured selection profile based on the available library genres.',
  input_schema: {
    type: 'object',
    required: ['crateName', 'genreKeywords', 'bpmMin', 'bpmMax', 'targetEnergy', 'sortOrder', 'moodNotes'],
    properties: {
      crateName: {
        type: 'string',
        description: 'Short descriptive name for the crate (max 40 chars)',
      },
      genreKeywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Genre keywords to match against the library. Use broad terms if specific sub-genres may not be in the library.',
      },
      bpmMin: {
        type: 'number',
        description: 'Minimum BPM for track selection',
      },
      bpmMax: {
        type: 'number',
        description: 'Maximum BPM for track selection',
      },
      targetEnergy: {
        type: 'string',
        enum: ['warmup', 'build', 'peak', 'mixed'],
        description: 'Energy level of the crate',
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc', 'energy_arc'],
        description: 'asc = low-to-high BPM (warmup/build), desc = high-to-low (peak), energy_arc = ascending arc',
      },
      moodNotes: {
        type: 'string',
        description: 'One sentence describing the vibe/context of this crate',
      },
      targetCount: {
        type: 'number',
        description: 'Only set this if the prompt explicitly names a number of tracks (e.g. "30-track set", "give me 20"). Otherwise omit it.',
      },
    },
  },
};

const SYSTEM = `You are a DJ library tool. You parse natural-language crate prompts into structured selection profiles.

Common prompt patterns:
- "Friday peak 1am" → peak energy, 128-135 BPM, genre from library's dominant genre, desc sort
- "Wedding cocktail hour" → warmup/mixed, 95-115 BPM, mainstream genres, asc sort
- "Warmup set" → warmup energy, 118-126 BPM, asc sort
- "Tech house peak" → peak, 128-134 BPM, genreKeywords: ["tech house", "house"], desc sort
- "Afrobeats vibes" → mixed, 100-118 BPM, genreKeywords: ["afrobeats", "afro"], energy_arc sort
- "Hip hop warmup" → warmup/build, 80-95 BPM, genreKeywords: ["hip hop", "r&b"], asc sort

BPM guidance by genre family:
- House / Tech House: warmup 118-124, build 124-128, peak 128-135
- Techno: warmup 128-134, peak 138-148
- Hip Hop / Trap: warmup 75-88, build 88-100, peak 100-115
- Afrobeats: 98-118
- R&B / Soul: 70-100
- Latin / Reggaeton: 85-100
- Pop / Top 40: 95-130

Use genreKeywords that would match what's in a typical DJ's Serato library (Serato genres are often broad: "House", "Hip Hop", "R&B", etc.).
If (and only if) the prompt names a specific number of tracks (e.g. "30-track warmup", "give me 20"), set targetCount to that number; otherwise omit it.
Call parse_crate_prompt with the structured profile.`;

// ─── Track filtering & sorting ────────────────────────────────────────────────

interface ExtraFilters {
  yearMin?: number;
  yearMax?: number;
  excludeArtists?: string[];
  cleanOnly?: boolean;
}

// Normalize a genre/tag for comparison: lowercase and collapse any run of
// non-alphanumerics (hyphens, slashes, extra spaces) to a single space. This is
// what makes "Nu-Disco", "nu disco", and "nu disco / disco" all comparable.
function normGenre(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

interface FilterResult {
  tracks: RawTrack[];
  // True when the user asked for a specific genre (so callers can message about it).
  genreRequested: boolean;
  // How many tracks actually matched the requested genre.
  genreMatchCount: number;
}

function filterTracks(raw: RawTrack[], profile: CrateProfile, extra: ExtraFilters = {}): FilterResult {
  const { bpmMin, bpmMax, genreKeywords } = profile;
  const { yearMin, yearMax, excludeArtists, cleanOnly } = extra;

  const excludeLower = (excludeArtists ?? []).map(a => a.toLowerCase().trim()).filter(Boolean);
  const cleanPattern = /\(clean\)|\[clean\]|clean edit|radio edit/i;

  const pool = raw.filter(t => {
    const bpm = t.bpm ?? 0;
    if (bpm < bpmMin || bpm > bpmMax) return false;

    // Year range
    if (yearMin !== undefined && (t.year == null || t.year < yearMin)) return false;
    if (yearMax !== undefined && (t.year == null || t.year > yearMax)) return false;

    // Exclude artists
    if (excludeLower.length) {
      const artist = (t.artist ?? '').toLowerCase();
      if (excludeLower.some(ex => artist.includes(ex))) return false;
    }

    // Clean only — keep explicitly-labeled clean tracks, block explicitly-labeled dirty ones
    if (cleanOnly) {
      const titleLower = (t.title ?? '').toLowerCase();
      const isDirtyVersion = /\(dirty\)|\[dirty\]|dirty version|dirty edit|dirty mix/i.test(titleLower);
      if (isDirtyVersion || !cleanPattern.test(titleLower)) return false;
    }

    return true;
  });

  const kwNorms = genreKeywords.map(normGenre).filter(Boolean);
  if (!kwNorms.length) {
    return { tracks: pool, genreRequested: false, genreMatchCount: pool.length };
  }

  const matched = pool.filter(t => {
    const g = normGenre(t.genre ?? '');
    const tags = (t.lastfm_tags ?? []).map(normGenre).filter(Boolean);
    // Untagged tracks must never match a specific genre. (The old code compared
    // against '' via kw.includes(genre), which is always true, so untagged junk
    // matched every genre — the root cause of wrong-genre crates.)
    if (!g && !tags.length) return false;
    return kwNorms.some(kw =>
      (g !== '' && (g.includes(kw) || kw.includes(g))) ||
      tags.some(tag => tag.includes(kw) || kw.includes(tag)),
    );
  });

  // Return only the genre-matched tracks — never silently fall back to the full
  // BPM pool. The caller decides how to message a thin or empty match.
  return { tracks: matched, genreRequested: true, genreMatchCount: matched.length };
}

// Evenly sample n items across an ascending-sorted list so a capped crate spans
// the whole BPM range instead of clustering at the low (or high) end.
function sampleAcross<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = items.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(items[Math.floor(i * step)]);
  return out;
}

// Build-to-peak-then-cool-down ordering over an ascending-sorted list: climb
// through the lower body, hit the peak, then ease back down.
function arcOrder(asc: RawTrack[]): RawTrack[] {
  if (asc.length < 4) return asc;
  const peakIdx = Math.floor(asc.length * 0.75);
  const rising = asc.slice(0, peakIdx);          // low → near-peak
  const cooldown = asc.slice(peakIdx).reverse();  // peak → descending
  return [...rising, ...cooldown];
}

// Select the crate (applying the size cap as a spread across the BPM range) and
// order it per the requested sort. Cap is applied before arc shaping so the arc
// spans the final set. `cap === null` means no cap.
function orderAndCap(
  tracks: RawTrack[],
  sortOrder: CrateProfile['sortOrder'],
  cap: number | null,
): RawTrack[] {
  const asc = tracks
    .filter(t => t.bpm != null)
    .sort((a, b) => (a.bpm ?? 0) - (b.bpm ?? 0));
  const withoutBpm = tracks.filter(t => t.bpm == null);

  const selected = cap != null ? sampleAcross(asc, cap) : asc;

  let ordered: RawTrack[];
  if (sortOrder === 'desc') ordered = [...selected].reverse();
  else if (sortOrder === 'energy_arc') ordered = arcOrder(selected);
  else ordered = selected; // asc

  // Backfill any remaining slots with BPM-less tracks, kept at the end.
  const remaining = cap != null ? Math.max(0, cap - ordered.length) : withoutBpm.length;
  return [...ordered, ...withoutBpm.slice(0, remaining)];
}

function toStoredTrack(t: RawTrack): CrateTrack {
  return {
    id: t.id,
    artist: t.artist ?? '',
    title: t.title ?? '',
    bpm: t.bpm,
    key: t.key,
    genre: t.genre,
    year: t.year,
    filePath: t.file_path,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { banned, isBeta } = await recordUsage(user.id, 'crates-generate');
    if (banned) return NextResponse.json({ error: 'account_suspended' }, { status: 403 });

    if (!isBeta) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();
      const { data: userRow } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();
      const tier = (userRow?.subscription_tier ?? 'free') as 'free' | 'pro';
      const crateLimit = tier === 'pro' ? 30 : 3;

      const { count } = await supabase
        .from('themed_crates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo);

      if ((count ?? 0) >= crateLimit) {
        return NextResponse.json({ error: 'quota_exhausted', tier, limit: crateLimit }, { status: 429 });
      }
    }

    const body = await req.json() as { prompt?: string; name?: string; genre?: string; bpmMin?: number; bpmMax?: number; yearMin?: number; yearMax?: number; excludeArtists?: string[]; cleanOnly?: boolean; targetCount?: number };
    const prompt = (body.prompt ?? '').trim();
    if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });

    const admin = createAdminClient();

    const { data: library } = await admin
      .from('serato_libraries')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!library) return NextResponse.json({ error: 'No library found' }, { status: 404 });

    const { data: rawTracks } = await admin
      .from('serato_tracks')
      .select('id, artist, title, bpm, key, genre, year, file_path, lastfm_tags')
      .eq('library_id', library.id)
      .eq('in_library', true)
      .limit(100000);

    if (!rawTracks?.length) return NextResponse.json({ error: 'Library is empty' }, { status: 404 });

    // Summarise available genres for Claude context
    const genreCounts: Record<string, number> = {};
    for (const t of rawTracks) {
      const g = (t.genre ?? 'Unknown').trim();
      genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    }
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([g, n]) => `${g} (${n})`);

    // Claude parses the prompt into a selection profile
    const anthropic = getAnthropic();
    const userMsg = `Crate prompt: "${prompt}"\n\nLibrary genres available: ${topGenres.join(', ')}\n\nCall parse_crate_prompt with a selection profile.`;

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
      tools: [PROFILE_TOOL],
      tool_choice: { type: 'tool', name: 'parse_crate_prompt' },
    }, { timeout: 45_000 });

    const block = msg.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
    );
    if (!block) throw new Error('No tool_use block from parse_crate_prompt');

    const profile = block.input as CrateProfile;

    // Apply explicit overrides from request body
    if (body.name) profile.crateName = body.name;
    if (body.genre) profile.genreKeywords = [body.genre];
    if (body.bpmMin !== undefined) profile.bpmMin = body.bpmMin;
    if (body.bpmMax !== undefined) profile.bpmMax = body.bpmMax;

    const extra: ExtraFilters = {
      yearMin: body.yearMin,
      yearMax: body.yearMax,
      excludeArtists: body.excludeArtists,
      cleanOnly: body.cleanOnly,
    };

    // Filter, then select + order.
    const { tracks: filtered, genreRequested, genreMatchCount } =
      filterTracks(rawTracks as RawTrack[], profile, extra);
    // Size precedence: an explicit UI count wins; targetCount: 0 means "All" (no
    // cap); when the UI leaves it on Auto (undefined), use a count parsed from the
    // prompt, else DEFAULT_CRATE_SIZE so a broad genre can't produce a huge crate.
    let cap: number | null;
    if (body.targetCount === 0) cap = null;
    else if (typeof body.targetCount === 'number' && body.targetCount > 0) cap = body.targetCount;
    else if (typeof profile.targetCount === 'number' && profile.targetCount > 0) cap = profile.targetCount;
    else cap = DEFAULT_CRATE_SIZE;
    const ordered = orderAndCap(filtered, profile.sortOrder, cap);
    const selected = ordered.map(toStoredTrack);

    if (!selected.length) {
      // Genre requested but nothing tagged with it: the honest failure. Previously
      // this silently returned unrelated BPM-matched tracks.
      if (genreRequested) {
        const genreLabel = profile.genreKeywords[0] ?? 'that genre';
        return NextResponse.json({
          error: `No tracks tagged "${genreLabel}" in your library — check the spelling or try a broader genre.`,
          profile,
        }, { status: 422 });
      }
      // A year filter is the most common cause of an empty result: tracks synced
      // before year support have no year and are excluded. Point the user there.
      const yearActive = body.yearMin !== undefined || body.yearMax !== undefined;
      const withYear = (rawTracks as RawTrack[]).filter(t => t.year != null).length;
      const error = yearActive && withYear === 0
        ? 'No tracks matched — your library has no year data yet. Re-sync your library in Library to enable year filtering, or remove the year range.'
        : 'No tracks matched these filters — try widening the BPM or year range.';
      return NextResponse.json({ error, profile }, { status: 422 });
    }

    // Thin genre match: still return the crate, but flag it so the UI can say so.
    const warning = genreRequested && genreMatchCount < GENRE_MATCH_WARN_FLOOR
      ? `Only ${genreMatchCount} track${genreMatchCount === 1 ? '' : 's'} matched "${profile.genreKeywords[0]}" — try a broader genre or enrich your library.`
      : undefined;

    // Persist the crate
    const { data: crate, error: insertErr } = await admin
      .from('themed_crates')
      .insert({
        user_id: user.id,
        name: profile.crateName,
        prompt,
        tracks_json: selected,
      })
      .select('id, name, prompt, tracks_json, created_at')
      .single();

    if (insertErr || !crate) {
      throw new Error(insertErr?.message ?? 'Failed to save crate');
    }

    return NextResponse.json({
      crate: {
        id: crate.id,
        name: crate.name,
        prompt: crate.prompt,
        tracks: crate.tracks_json as CrateTrack[],
        moodNotes: profile.moodNotes,
        createdAt: crate.created_at,
      },
      ...(warning ? { warning } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[crates/generate]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
