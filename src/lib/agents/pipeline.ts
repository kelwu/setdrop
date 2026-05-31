import Anthropic from '@anthropic-ai/sdk';
import {
  SetlistInput, LibraryTrack, LibraryProfile, GigIntelReport,
  SetBlueprint, GeneratedSetlist,
} from './types';
import { GIG_BLUEPRINT_SYSTEM, SELECTOR_REVIEWER_SYSTEM } from './prompts';

const MODEL = 'claude-sonnet-4-6';
const MAX_SELECTOR_TRACKS = 200;

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
            spotifyUrl: { type: 'string' },
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
): Promise<T> {
  const anthropic = client();
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
  });

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
  const bpmMin = bpms.length ? Math.min(...bpms) : 0;
  const bpmMax = bpms.length ? Math.max(...bpms) : 0;
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
): LibraryTrack[] {
  const bpmMin = Math.min(...blueprint.phases.map(p => p.bpmRange.min)) - 15;
  const bpmMax = Math.max(...blueprint.phases.map(p => p.bpmRange.max)) + 15;
  const primaryGenre = input.primaryGenre.toLowerCase();
  const secondaryGenre = input.secondaryGenre?.toLowerCase() ?? '';
  const seeds = (input.seedTracks ?? []).map(s => s.toLowerCase());

  const isSeed = (t: LibraryTrack) =>
    seeds.some(s => t.title.toLowerCase().includes(s) || t.artist.toLowerCase().includes(s));

  const scored = tracks
    .filter(t => !t.isWishlist && !isSeed(t))
    .map(t => {
      let score = 0;
      const g = (t.genre ?? '').toLowerCase();
      if (g.includes(primaryGenre) || primaryGenre.includes(g)) score += 3;
      else if (secondaryGenre && (g.includes(secondaryGenre) || secondaryGenre.includes(g))) score += 2;
      if (t.bpm >= bpmMin && t.bpm <= bpmMax) score += 2;
      if (t.lastfmTags?.length) score += 1;
      return { t, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SELECTOR_TRACKS)
    .map(({ t }) => t);

  // Always include seed tracks and wishlist tracks
  const pinned = tracks.filter(t => t.isWishlist || isSeed(t));
  return [...pinned, ...scored];
}

// Call 1: Gig intel + blueprint — web search for live venue/trend context, then structured output
async function runGigBlueprint(
  profile: LibraryProfile,
  input: SetlistInput,
): Promise<{ gigIntel: GigIntelReport; blueprint: SetBlueprint }> {
  const anthropic = client();
  const userMessage = `Library profile:
${JSON.stringify(profile, null, 2)}

Gig context:
- Venue: ${input.venueContext || 'Not specified'}
- Crowd: ${input.crowdContext}
- Primary genre: ${input.primaryGenre}
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
  });

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
  });

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
): Promise<{ tracks: GeneratedSetlist['tracks']; reviewNotes: string }> {
  return callWithTool(
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
    8192,
  );
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
  onProgress?: (event: PipelineProgressEvent) => void,
): Promise<GeneratedSetlist> {
  onProgress?.({ type: 'step', step: 1, message: 'Gathering gig intel...' });
  const profile = computeLibraryProfile(tracks);

  onProgress?.({ type: 'step', step: 2, message: 'Architecting the set structure...' });
  const { gigIntel: intel, blueprint } = await runGigBlueprint(profile, input);

  onProgress?.({ type: 'step', step: 3, message: 'Selecting and sequencing tracks...' });
  const filtered = filterTracksForGig(tracks, blueprint, input);

  const reviewed = await runSelectorReviewer(input, filtered, blueprint, intel, recentlyPlayed);

  onProgress?.({ type: 'step', step: 4, message: 'Reviewing transitions and flow...' });

  return {
    name: input.name || 'Untitled Set',
    tracks: reviewed.tracks,
    reviewNotes: reviewed.reviewNotes,
    shareSlug: generateSlug(input.name || 'set'),
  };
}
