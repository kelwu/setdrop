import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recordUsage } from '@/lib/api-usage';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawTrack {
  id: string;
  artist: string | null;
  title: string | null;
  bpm: number | null;
  key: string | null;
  genre: string | null;
  file_path: string | null;
  lastfm_tags: string[] | null;
}

export interface CrateTrack {
  id: string;
  artist: string;
  title: string;
  bpm: number | null;
  key: string | null;
  genre: string | null;
  filePath: string | null;
}

interface CrateProfile {
  crateName: string;
  genreKeywords: string[];
  bpmMin: number;
  bpmMax: number;
  targetEnergy: 'warmup' | 'build' | 'peak' | 'mixed';
  sortOrder: 'asc' | 'desc' | 'energy_arc';
  moodNotes: string;
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
Call parse_crate_prompt with the structured profile.`;

// ─── Track filtering & sorting ────────────────────────────────────────────────

function filterTracks(raw: RawTrack[], profile: CrateProfile): RawTrack[] {
  const { bpmMin, bpmMax, genreKeywords } = profile;

  const byBpm = raw.filter(t => {
    const bpm = t.bpm ?? 0;
    return bpm >= bpmMin && bpm <= bpmMax;
  });

  if (!genreKeywords.length) return byBpm;

  const keywords = genreKeywords.map(k => k.toLowerCase());

  const matched = byBpm.filter(t => {
    const genre = (t.genre ?? '').toLowerCase();
    const tags = (t.lastfm_tags ?? []).map(s => s.toLowerCase());
    return keywords.some(kw =>
      genre.includes(kw) || kw.includes(genre) ||
      tags.some(tag => tag.includes(kw) || kw.includes(tag)),
    );
  });

  // If genre filter is too restrictive, fall back to BPM-only
  return matched.length >= 5 ? matched : byBpm;
}

function sortTracks(tracks: RawTrack[], sortOrder: CrateProfile['sortOrder']): RawTrack[] {
  const withBpm = [...tracks.filter(t => t.bpm != null)];
  const withoutBpm = tracks.filter(t => t.bpm == null);

  if (sortOrder === 'desc') {
    withBpm.sort((a, b) => (b.bpm ?? 0) - (a.bpm ?? 0));
  } else {
    // asc and energy_arc both sort ascending (low → high builds energy)
    withBpm.sort((a, b) => (a.bpm ?? 0) - (b.bpm ?? 0));
  }

  return [...withBpm, ...withoutBpm];
}

function toStoredTrack(t: RawTrack): CrateTrack {
  return {
    id: t.id,
    artist: t.artist ?? '',
    title: t.title ?? '',
    bpm: t.bpm,
    key: t.key,
    genre: t.genre,
    filePath: t.file_path,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { banned } = await recordUsage(user.id, 'crates-generate');
    if (banned) return NextResponse.json({ error: 'account_suspended' }, { status: 403 });

    const body = await req.json() as { prompt?: string; targetCount?: number };
    const prompt = (body.prompt ?? '').trim();
    if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });

    const targetCount = Math.min(Math.max(body.targetCount ?? 20, 5), 50);

    const admin = createAdminClient();

    const { data: library } = await admin
      .from('serato_libraries')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!library) return NextResponse.json({ error: 'No library found' }, { status: 404 });

    const { data: rawTracks } = await admin
      .from('serato_tracks')
      .select('id, artist, title, bpm, key, genre, file_path, lastfm_tags')
      .eq('library_id', library.id)
      .eq('in_library', true);

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
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const userMsg = `Crate prompt: "${prompt}"\n\nLibrary genres available: ${topGenres.join(', ')}\n\nCall parse_crate_prompt with a selection profile.`;

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
      tools: [PROFILE_TOOL],
      tool_choice: { type: 'tool', name: 'parse_crate_prompt' },
    });

    const block = msg.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
    );
    if (!block) throw new Error('No tool_use block from parse_crate_prompt');

    const profile = block.input as CrateProfile;

    // Filter and sort library tracks
    const filtered = filterTracks(rawTracks as RawTrack[], profile);
    const sorted = sortTracks(filtered, profile.sortOrder);
    const selected = sorted.slice(0, targetCount).map(toStoredTrack);

    if (!selected.length) {
      return NextResponse.json({
        error: 'No tracks matched this prompt — try a different genre or BPM range',
        profile,
      }, { status: 422 });
    }

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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[crates/generate]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
