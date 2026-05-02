import Anthropic from '@anthropic-ai/sdk';
import {
  SetlistInput, LibraryTrack, LibraryProfile, GigIntelReport,
  SetBlueprint, GeneratedSetlist,
} from './types';
import { PLANNER_SYSTEM, SELECTOR_REVIEWER_SYSTEM } from './prompts';

const MODEL = 'claude-sonnet-4-6';

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function parseJSON<T>(text: string): T {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  const raw = match ? match[1] : text;
  return JSON.parse(raw.trim()) as T;
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

// Call 1: Profile library + assess gig + design blueprint in one pass
async function runPlanner(
  tracks: LibraryTrack[],
  input: SetlistInput,
): Promise<{ libraryProfile: LibraryProfile; gigIntel: GigIntelReport; blueprint: SetBlueprint }> {
  const trackData = tracks.map(t => ({
    artist: t.artist, title: t.title, bpm: t.bpm, key: t.key,
    genre: t.genre, lastfmTags: t.lastfmTags ?? [],
    seratoEnergy: t.seratoEnergy, isWishlist: t.isWishlist,
  }));
  return callAgent(
    PLANNER_SYSTEM,
    `Library (${tracks.length} tracks):
${JSON.stringify(trackData, null, 2)}

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

// Call 2: Select tracks and write polished notes in one pass
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
${JSON.stringify(tracks, null, 2)}`,
    4096,
  );
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '-' + Math.random().toString(36).slice(2, 7);
}

// Main pipeline — 2 LLM calls (was 5)
export async function runSetlistPipeline(
  input: SetlistInput,
  tracks: LibraryTrack[],
  recentlyPlayed: string[] = []
): Promise<GeneratedSetlist> {
  const { gigIntel: intel, blueprint } = await runPlanner(tracks, input);
  const reviewed = await runSelectorReviewer(input, tracks, blueprint, intel, recentlyPlayed);

  return {
    name: input.name || 'Untitled Set',
    tracks: reviewed.tracks,
    reviewNotes: reviewed.reviewNotes,
    shareSlug: generateSlug(input.name || 'set'),
  };
}
