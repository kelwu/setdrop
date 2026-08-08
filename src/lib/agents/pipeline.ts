import Anthropic from '@anthropic-ai/sdk';
import { getAnthropic } from '@/lib/anthropic';
import { usageFrom, type CallUsage } from '@/lib/api-usage';
import {
  SetlistInput, LibraryTrack, LibraryProfile, GigIntelReport,
  SetBlueprint, GeneratedSetlist,
} from './types';
import { GIG_BLUEPRINT_SYSTEM, SELECTOR_REVIEWER_SYSTEM } from './prompts';
import { camelotRelation, toCamelot } from '@/lib/setdrop/key-utils';
import { genreRelevance, superFamily } from '@/lib/setdrop/genre';
import { MIN_SUPERFAMILY_TRACKS, targetTrackCount } from '@/lib/setdrop/readiness';
import { TasteAffinity, affinityTrackKey, affinityArtistKey } from '@/lib/setdrop/taste';

// Notes are model-generated free text; occasionally the model leaks its own
// reasoning into them (e.g. "Wait — pos 17… Planning accordingly…"). The prompt
// forbids this; this strips any that slips through so users never see scratchpad.
const LEAK_MARKERS = [/\bWait\s*[—–-]/i, /planning accordingly/i, /respect the .*?rule/i, /\bpos\.?\s*\d+/i, /\bposition\s+\d+\b/i];
function stripLeaked(s: string, fallback: string): string {
  if (!s) return fallback;
  if (!LEAK_MARKERS.some(m => m.test(s))) return s;
  const kept = s
    .split(/(?<=[.!?])\s+/)
    .filter(c => !LEAK_MARKERS.some(m => m.test(c)))
    .join(' ')
    .trim();
  return kept || fallback;
}

const MODEL = 'claude-sonnet-4-6';
const MAX_SELECTOR_TRACKS = 200;

// The route runs with maxDuration = 300s. Abort the whole pipeline before that
// ceiling so we can surface a real error to the client instead of a stream that
// the platform silently kills mid-flight (which the user sees as a hang).
const PIPELINE_TIMEOUT_MS = 270_000;
// Per-call ceilings so a single hung API request fails fast instead of eating the
// entire budget. The SDK's own default timeout is 10min — longer than our function
// limit — so without these a stalled call always blows past 300s.
const BLUEPRINT_TIMEOUT_MS = 120_000;
const SELECTOR_TIMEOUT_MS = 180_000;

type CallOptions = { signal?: AbortSignal; timeout?: number; onUsage?: (u: CallUsage) => void };

function isTimeoutOrAbort(err: unknown): boolean {
  if (err instanceof Anthropic.APIUserAbortError) return true;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return true;
  const name = (err as { name?: string } | null)?.name;
  return name === 'AbortError' || name === 'TimeoutError';
}

// Shared client; per-call { timeout } options below still override its default.
function client() {
  return getAnthropic();
}

const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20260209 = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 2,
};

const GIG_BLUEPRINT_TOOL: Anthropic.Tool = {
  name: 'generate_gig_blueprint',
  description: 'Output gig intelligence and set blueprint.',
  input_schema: {
    type: 'object',
    required: ['gigIntel', 'blueprint'],
    properties: {
      gigIntel: {
        type: 'object',
        required: ['crowdProfile', 'trendingGenres', 'recommendedBpmRange', 'avoidArtists', 'contextNotes'],
        properties: {
          venueName: { type: 'string' },
          crowdProfile: { type: 'string' },
          trendingGenres: { type: 'array', items: { type: 'string' } },
          recommendedBpmRange: {
            type: 'object',
            required: ['min', 'max'],
            properties: { min: { type: 'number' }, max: { type: 'number' } },
          },
          avoidArtists: { type: 'array', items: { type: 'string' } },
          contextNotes: { type: 'string' },
        },
      },
      blueprint: {
        type: 'object',
        required: ['totalTracks', 'phases', 'transitionStrategy', 'openerHeadlinerNotes'],
        properties: {
          totalTracks: { type: 'number' },
          phases: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'trackCount', 'energyTarget', 'bpmRange', 'genreGuidance'],
              properties: {
                name: { type: 'string' },
                trackCount: { type: 'number' },
                energyTarget: { type: 'number' },
                bpmRange: {
                  type: 'object',
                  required: ['min', 'max'],
                  properties: { min: { type: 'number' }, max: { type: 'number' } },
                },
                genreGuidance: { type: 'string' },
              },
            },
          },
          transitionStrategy: { type: 'string' },
          openerHeadlinerNotes: { type: 'string' },
        },
      },
    },
  },
};

const SELECTOR_TOOL: Anthropic.Tool = {
  name: 'select_and_sequence_tracks',
  description: 'Output the final ordered tracklist and review notes.',
  input_schema: {
    type: 'object',
    required: ['tracks', 'reviewNotes'],
    properties: {
      tracks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['position', 'artist', 'title', 'bpm', 'key', 'energyLevel', 'whyThisTrack', 'transitionNotes', 'harmonicMixingNotes', 'isWishlistTrack'],
          properties: {
            position: { type: 'number' },
            artist: { type: 'string' },
            title: { type: 'string' },
            bpm: { type: 'number' },
            key: { type: 'string' },
            energyLevel: { type: 'number' },
            whyThisTrack: { type: 'string' },
            transitionNotes: { type: 'string' },
            harmonicMixingNotes: { type: 'string' },
            wordplayConnection: { type: 'string' },
            isWishlistTrack: { type: 'boolean' },
            beatportUrl: { type: 'string' },
            bpmSupremeSearchUrl: { type: 'string' },
            traxsourceSearchUrl: { type: 'string' },
            djcitySearchUrl: { type: 'string' },
          },
        },
      },
      reviewNotes: { type: 'string' },
    },
  },
};

async function callWithTool<T>(
  system: string,
  userMessage: string,
  tool: Anthropic.Tool,
  maxTokens: number,
  options: CallOptions = {},
): Promise<T> {
  const anthropic = client();
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
  }, { signal: options.signal, timeout: options.timeout });
  options.onUsage?.(usageFrom(MODEL, msg));

  const block = msg.content.find(b => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error(`Expected tool_use block from ${tool.name}`);
  }
  return block.input as T;
}

// Compute library profile from tracks in code — no LLM needed
function computeLibraryProfile(tracks: LibraryTrack[]): LibraryProfile {
  const genreCounts: Record<string, number> = {};
  const artistCounts: Record<string, number> = {};
  const keyCounts: Record<string, number> = {};
  let low = 0, mid = 0, high = 0, wishlist = 0;
  const bpms: number[] = [];

  for (const t of tracks) {
    const g = t.genre || 'Unknown';
    genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    artistCounts[t.artist] = (artistCounts[t.artist] ?? 0) + 1;
    if (t.key) keyCounts[t.key] = (keyCounts[t.key] ?? 0) + 1;
    if (t.bpm > 0) bpms.push(t.bpm);
    if (t.bpm > 0 && t.bpm < 100) low++;
    else if (t.bpm >= 100 && t.bpm <= 125) mid++;
    else if (t.bpm > 125) high++;
    if (t.isWishlist) wishlist++;
  }

  const total = tracks.length || 1;
  const genreDistribution = Object.fromEntries(
    Object.entries(genreCounts).map(([g, c]) => [g, Math.round((c / total) * 100)])
  );
  const topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([a]) => a);
  const bpmMin = bpms.length ? bpms.reduce((a, b) => a < b ? a : b) : 0;
  const bpmMax = bpms.length ? bpms.reduce((a, b) => a > b ? a : b) : 0;
  const bpmAvg = bpms.length ? Math.round(bpms.reduce((s, b) => s + b, 0) / bpms.length) : 0;

  const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  const strengths = topGenres.slice(0, 3).map(([g, c]) => `Strong ${g} selection (${c} tracks)`);
  const gaps = topGenres.length > 5
    ? topGenres.slice(-3).map(([g]) => `Limited ${g} representation`)
    : [];

  return {
    totalTracks: total, genreDistribution,
    bpmRange: { min: bpmMin, max: bpmMax, avg: bpmAvg },
    energySpread: { low, mid, high },
    topArtists, keyDistribution: keyCounts,
    wishlistCount: wishlist, strengths, gaps,
  };
}

// Filter library down to the most relevant tracks for this gig
function filterTracksForGig(
  tracks: LibraryTrack[],
  blueprint: SetBlueprint,
  input: SetlistInput,
  affinity?: TasteAffinity,
): LibraryTrack[] {
  const bpmMin = Math.min(...blueprint.phases.map(p => p.bpmRange.min)) - 15;
  const bpmMax = Math.max(...blueprint.phases.map(p => p.bpmRange.max)) + 15;
  const seeds = (input.seedTracks ?? []).map(s => s.toLowerCase());

  const isSeed = (t: LibraryTrack) =>
    seeds.some(s => t.title.toLowerCase().includes(s) || t.artist.toLowerCase().includes(s));

  // Playlist mode: the DJ already curated the pool, so genre is NOT a gate — every
  // track passes (scored 0 on genre; BPM/tags/affinity still order it below).
  const playlistMode = !!input.sourcePlaylist;

  // Genre relevance GATES the pool: a track in a different super-family than the gig
  // (e.g. R&B for a Trance gig) is excluded outright — genre is not a soft bonus that a
  // tempo match can tie. Score by tier (exact 4 / family 3 / adjacent 2 / unknown 0).
  // Secondary genre can rescue a track. Returns null when the track is excluded.
  const genreScoreFor = (t: LibraryTrack): number | null => {
    if (playlistMode) return 0;
    const primary = genreRelevance(input.primaryGenre, t.genre ?? '', t.lastfmTags ?? []);
    const secondary = input.secondaryGenre
      ? genreRelevance(input.secondaryGenre, t.genre ?? '', t.lastfmTags ?? [])
      : null;
    const best = Math.max(primary.score, secondary?.score ?? -1);
    return best >= 0 ? best : null; // 'off' from both scores -1 → excluded
  };

  // Cap candidates per artist so a library skewed toward one artist can't produce
  // an artist-skewed pool (which is what makes the selector over-repeat). Keeps each
  // artist's highest-scoring tracks; the set-level "max 2 per artist" is enforced by
  // the selector prompt on top of this.
  const POOL_PER_ARTIST_CAP = 3;
  const perArtist: Record<string, number> = {};

  const scored = tracks
    .filter(t => !t.isWishlist && !isSeed(t))
    .map(t => ({ t, genre: genreScoreFor(t) }))
    .filter((x): x is { t: LibraryTrack; genre: number } => x.genre !== null)
    .map(({ t, genre }) => {
      let score = genre;
      if (t.bpm >= bpmMin && t.bpm <= bpmMax) score += 2;
      if (t.lastfmTags?.length) score += 1;
      // Personalization: re-rank WITHIN the genre-relevant pool from the DJ's own
      // gig history. Bounded in taste.ts so it nudges order but never rescues an
      // off-genre track (already gated out above) or forces a track out entirely.
      if (affinity) {
        score += affinity.trackScores[affinityTrackKey(t.artist, t.title)] ?? 0;
        score += 0.5 * (affinity.artistScores[affinityArtistKey(t.artist)] ?? 0);
      }
      return { t, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter(({ t }) => {
      const key = t.artist.toLowerCase().trim();
      perArtist[key] = (perArtist[key] ?? 0) + 1;
      return perArtist[key] <= POOL_PER_ARTIST_CAP;
    })
    .slice(0, MAX_SELECTOR_TRACKS)
    .map(({ t }) => t);

  // Always include seed tracks and wishlist tracks (uncapped — user-requested)
  const pinned = tracks.filter(t => t.isWishlist || isSeed(t));
  return [...pinned, ...scored];
}

// Call 1: Gig intel + blueprint — web search for live venue/trend context, then structured output
async function runGigBlueprint(
  profile: LibraryProfile,
  input: SetlistInput,
  signal?: AbortSignal,
  onUsage?: (u: CallUsage) => void,
): Promise<{ gigIntel: GigIntelReport; blueprint: SetBlueprint }> {
  const anthropic = client();
  const userMessage = `Library profile:
${JSON.stringify(profile, null, 2)}

Gig context:
- Venue: ${input.venueContext || 'Not specified'}
- Crowd: ${input.crowdContext}
- Primary genre: ${input.primaryGenre
    || (input.sourcePlaylist
      ? `(building from the "${input.sourcePlaylist}" playlist — infer the dominant genre and energy from the library profile above)`
      : 'Not specified')}
- Secondary genre: ${input.secondaryGenre || 'None'}
- Lineup slot: ${input.lineupSlot}
- Duration: ${input.durationMinutes} minutes
- Vibe: ${input.vibe || 'Not specified'}
- Energy arc: ${JSON.stringify(input.energyArc)}`;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: GIG_BLUEPRINT_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
    tools: [WEB_SEARCH_TOOL, GIG_BLUEPRINT_TOOL],
    tool_choice: { type: 'auto' },
  }, { signal, timeout: BLUEPRINT_TIMEOUT_MS });
  onUsage?.(usageFrom(MODEL, msg));

  const blueprintBlock = msg.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock =>
      b.type === 'tool_use' && b.name === 'generate_gig_blueprint',
  );
  if (blueprintBlock) return blueprintBlock.input as { gigIntel: GigIntelReport; blueprint: SetBlueprint };

  // Model did web research but didn't call the blueprint tool yet — force it
  const forced = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: GIG_BLUEPRINT_SYSTEM,
    messages: [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: msg.content as unknown as Anthropic.Messages.ContentBlockParam[] },
      { role: 'user', content: 'Now call generate_gig_blueprint with your complete analysis.' },
    ],
    tools: [GIG_BLUEPRINT_TOOL],
    tool_choice: { type: 'tool', name: 'generate_gig_blueprint' },
  }, { signal, timeout: BLUEPRINT_TIMEOUT_MS });
  onUsage?.(usageFrom(MODEL, forced));

  const block = forced.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');
  if (!block) throw new Error('Expected tool_use block from generate_gig_blueprint');
  return block.input as { gigIntel: GigIntelReport; blueprint: SetBlueprint };
}

// Call 2: Select and write polished notes from filtered tracks
async function runSelectorReviewer(
  input: SetlistInput,
  tracks: LibraryTrack[],
  blueprint: SetBlueprint,
  intel: GigIntelReport,
  recentlyPlayed: string[],
  affinity?: TasteAffinity,
  signal?: AbortSignal,
  onUsage?: (u: CallUsage) => void,
): Promise<{ tracks: GeneratedSetlist['tracks']; reviewNotes: string }> {
  const result = await callWithTool<{ tracks: GeneratedSetlist['tracks']; reviewNotes: string }>(
    SELECTOR_REVIEWER_SYSTEM,
    `Set blueprint:
${JSON.stringify(blueprint, null, 2)}

Gig intel:
${JSON.stringify(intel, null, 2)}

User preferences:
- Setlist name: "${input.name || 'Untitled Set'}"
- Wordplay theme: ${input.wordplayTheme || 'None'}
- Seed tracks: ${input.seedTracks?.join(', ') || 'None'}

Recently played tracks (DO NOT repeat these):
${recentlyPlayed.length ? recentlyPlayed.map(t => `- ${t}`).join('\n') : 'None'}

Available tracks (${tracks.length} total):
${JSON.stringify(tracks.map(t => ({
  id: t.id, artist: t.artist, title: t.title,
  bpm: t.bpm, key: t.key, genre: t.genre,
  lastfmTags: t.lastfmTags ?? [], isWishlist: t.isWishlist,
})), null, 2)}`,
    SELECTOR_TOOL,
    16384,
    { signal, timeout: SELECTOR_TIMEOUT_MS, onUsage },
  );
  if (!result?.tracks?.length) {
    throw new Error('Selector returned no tracks — the model response may have been truncated. Please try again.');
  }

  // Own the harmonic assessment in code — the model fabricates Camelot distances.
  // This only annotates the already-selected/sequenced list (no reordering), and
  // scrubs any leaked reasoning from the free-text notes.
  const annotated = result.tracks.map((t, i) => {
    const next = result.tracks[i + 1];
    const harmonicMixingNotes = next
      ? `→ ${next.artist} "${next.title}" (${toCamelot(next.key) || next.key || '?'}): ${camelotRelation(t.key, next.key).label}`
      : 'Final track — let it ride out.';
    return {
      ...t,
      harmonicMixingNotes,
      transitionNotes: stripLeaked(t.transitionNotes, 'Blend into the next track: ride the outro, EQ-swap the bass, and drop on the downbeat.'),
      whyThisTrack: stripLeaked(t.whyThisTrack, ''),
    };
  });

  // Honesty: if an artist still appears 3+ times, the diversified pool was genuinely
  // too thin to avoid it — surface that rather than ship a lopsided set silently.
  const artistCounts: Record<string, { name: string; count: number }> = {};
  for (const t of annotated) {
    const key = t.artist.toLowerCase().trim();
    artistCounts[key] = { name: t.artist, count: (artistCounts[key]?.count ?? 0) + 1 };
  }
  const worst = Object.values(artistCounts).sort((a, b) => b.count - a.count)[0];
  let reviewNotes = result.reviewNotes;
  if (worst && worst.count >= 3) {
    const source = input.sourcePlaylist ? `"${input.sourcePlaylist}" playlist` : `${input.primaryGenre} library`;
    const fix = input.sourcePlaylist
      ? `Add more variety to the playlist to diversify future sets.`
      : `Add more ${input.primaryGenre} artists to diversify future sets.`;
    reviewNotes += `\n\nHeads up — this set repeats ${worst.name} ${worst.count}×: your ${source} is thin in this tempo range. ${fix}`;
  }

  // Transparency: personalization is automatic, so say when it happened and what it did.
  // Reuses this reviewNotes surface (no new UI). Only when there's real, corroborated
  // taste to name — go-to's leaned into and/or tracks the DJ keeps dropping eased off.
  if (affinity && affinity.gigsAnalyzed >= 2) {
    const fmt = (t: { artist: string; title: string }) => `${t.artist} — ${t.title}`;
    const goTos = affinity.goTos.slice(0, 3).map(fmt);
    const dropped = affinity.droppedOften.slice(0, 3).map(fmt);
    if (goTos.length || dropped.length) {
      const parts: string[] = [];
      if (goTos.length) parts.push(`leaned into your go-to's (${goTos.join(', ')})`);
      if (dropped.length) parts.push(`eased off tracks you keep dropping (${dropped.join(', ')})`);
      reviewNotes += `\n\nPersonalized from your last ${affinity.gigsAnalyzed} gigs: ${parts.join(' and ')}.`;
    }
  }

  return { tracks: annotated, reviewNotes };
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '-' + Math.random().toString(36).slice(2, 7);
}

export type PipelineProgressEvent = { type: 'step'; step: number; message: string };

// Main pipeline — profile in code + 2 LLM calls
export async function runSetlistPipeline(
  input: SetlistInput,
  tracks: LibraryTrack[],
  recentlyPlayed: string[] = [],
  affinity?: TasteAffinity,
  onProgress?: (event: PipelineProgressEvent) => void,
  onUsage?: (u: CallUsage) => void,
): Promise<GeneratedSetlist> {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), PIPELINE_TIMEOUT_MS);
  const { signal } = controller;

  try {
    onProgress?.({ type: 'step', step: 1, message: 'Gathering gig intel...' });
    const profile = computeLibraryProfile(tracks);

    // Playlist mode: the pool IS the curated playlist, so the genre floor doesn't apply.
    // Just make sure there are enough tracks to build the requested duration.
    const playlistMode = !!input.sourcePlaylist;
    const poolSize = tracks.filter(t => !t.isWishlist).length;
    if (playlistMode) {
      const target = targetTrackCount(input.durationMinutes);
      const floor = Math.min(target, 8); // don't block short sets; a handful of tracks is enough to try
      if (poolSize < floor) {
        throw new Error(
          `Your "${input.sourcePlaylist}" playlist has only ${poolSize} track${poolSize === 1 ? '' : 's'} — too few to build a ${input.durationMinutes}-minute set. Add more tracks to the playlist, or pick a shorter duration.`,
        );
      }
    }

    // Genre availability: fail fast if the library can't support the gig's super-family
    // (e.g. asking for Trance with an all-hip-hop library), and remember how many EXACT
    // genre matches exist so we can be honest when the set leans on adjacent genres.
    // Skipped entirely in playlist mode (genre may be absent and isn't a gate there).
    const gigSuper = superFamily(input.primaryGenre);
    let exactGenreCount = 0;
    let superFamilyCount = 0;
    if (!playlistMode) {
      for (const t of tracks) {
        if (t.isWishlist) continue;
        if (genreRelevance(input.primaryGenre, t.genre ?? '', t.lastfmTags ?? []).tier === 'exact') exactGenreCount++;
        if (gigSuper !== 'other' && superFamily(t.genre ?? '', t.lastfmTags ?? []) === gigSuper) superFamilyCount++;
      }
      if (gigSuper !== 'other' && superFamilyCount < MIN_SUPERFAMILY_TRACKS) {
        throw new Error(
          `Not enough tracks for a ${input.primaryGenre} set — your library has only ${superFamilyCount} ${gigSuper} track${superFamilyCount === 1 ? '' : 's'}. Import more ${input.primaryGenre} (or related) music and try again.`,
        );
      }
    }

    onProgress?.({ type: 'step', step: 2, message: 'Architecting the set structure...' });
    const { gigIntel: intel, blueprint } = await runGigBlueprint(profile, input, signal, onUsage);

    onProgress?.({ type: 'step', step: 3, message: 'Selecting and sequencing tracks...' });
    const filtered = filterTracksForGig(tracks, blueprint, input, affinity);

    const reviewed = await runSelectorReviewer(input, filtered, blueprint, intel, recentlyPlayed, affinity, signal, onUsage);

    onProgress?.({ type: 'step', step: 4, message: 'Reviewing transitions and flow...' });

    // Honesty: if there aren't enough true-genre tracks to fill the set, say the set
    // leans on adjacent genres rather than pretend it's pure. (No genre gate in
    // playlist mode, so this note doesn't apply.)
    let reviewNotes = reviewed.reviewNotes;
    if (!playlistMode && exactGenreCount < reviewed.tracks.length) {
      reviewNotes += `\n\nNote: your library has only ${exactGenreCount} true ${input.primaryGenre} track${exactGenreCount === 1 ? '' : 's'}, so this set is built largely from adjacent ${gigSuper} genres. Import more ${input.primaryGenre} for a truer ${input.primaryGenre} set.`;
    }

    return {
      name: input.name || 'Untitled Set',
      tracks: reviewed.tracks,
      reviewNotes,
      shareSlug: generateSlug(input.name || 'set'),
    };
  } catch (err) {
    if (isTimeoutOrAbort(err)) {
      throw new Error(
        'Setlist generation timed out. Your library may be large or the service is busy — please try again.',
      );
    }
    throw err;
  } finally {
    clearTimeout(deadline);
  }
}
