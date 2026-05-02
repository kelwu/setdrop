import Anthropic from '@anthropic-ai/sdk';
import { jsonrepair } from 'jsonrepair';
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

function parseJSON<T>(text: string): T {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  const raw = match ? match[1] : text;
  return JSON.parse(jsonrepair(raw.trim())) as T;
}

async function callAgent<T>(system: string, userMessage: string, maxTokens = 4096): Promise<T> {
  const anthropic = client();
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });
  const text = msg.content.find(b => b.type === 'text')?.text ?? '';
  return parseJSON<T>(text);
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

  const scored = tracks
    .filter(t => !t.isWishlist)
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

  // Always include wishlist tracks
  const wishlist = tracks.filter(t => t.isWishlist);
  return [...scored, ...wishlist];
}

// Call 1: Gig intel + blueprint from pre-computed profile (small input)
async function runGigBlueprint(
  profile: LibraryProfile,
  input: SetlistInput,
): Promise<{ gigIntel: GigIntelReport; blueprint: SetBlueprint }> {
  return callAgent(
    GIG_BLUEPRINT_SYSTEM,
    `Library profile:
${JSON.stringify(profile, null, 2)}

Gig context:
- Venue: ${input.venueContext || 'Not specified'}
- Crowd: ${input.crowdContext}
- Primary genre: ${input.primaryGenre}
- Secondary genre: ${input.secondaryGenre || 'None'}
- Lineup slot: ${input.lineupSlot}
- Duration: ${input.durationMinutes} minutes
- Vibe: ${input.vibe || 'Not specified'}
- Energy arc: ${JSON.stringify(input.energyArc)}`,
    2048,
  );
}

// Call 2: Select and write polished notes from filtered tracks
async function runSelectorReviewer(
  input: SetlistInput,
  tracks: LibraryTrack[],
  blueprint: SetBlueprint,
  intel: GigIntelReport,
  recentlyPlayed: string[],
): Promise<{ tracks: GeneratedSetlist['tracks']; reviewNotes: string }> {
  return callAgent(
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
    8192,
  );
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '-' + Math.random().toString(36).slice(2, 7);
}

// Main pipeline — profile in code + 2 LLM calls
export async function runSetlistPipeline(
  input: SetlistInput,
  tracks: LibraryTrack[],
  recentlyPlayed: string[] = []
): Promise<GeneratedSetlist> {
  const profile = computeLibraryProfile(tracks);
  const { gigIntel: intel, blueprint } = await runGigBlueprint(profile, input);
  const filtered = filterTracksForGig(tracks, blueprint, input);
  const reviewed = await runSelectorReviewer(input, filtered, blueprint, intel, recentlyPlayed);

  return {
    name: input.name || 'Untitled Set',
    tracks: reviewed.tracks,
    reviewNotes: reviewed.reviewNotes,
    shareSlug: generateSlug(input.name || 'set'),
  };
}
