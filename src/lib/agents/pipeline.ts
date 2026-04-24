import Anthropic from '@anthropic-ai/sdk';
import {
  SetlistInput, LibraryTrack, LibraryProfile, GigIntelReport,
  SetBlueprint, SelectedTrack, GeneratedSetlist,
} from './types';
import {
  ANALYST_SYSTEM, GIG_INTEL_SYSTEM, ARCHITECT_SYSTEM,
  SELECTOR_SYSTEM, REVIEWER_SYSTEM,
} from './prompts';

const MODEL = 'claude-sonnet-4-20250514';

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function parseJSON<T>(text: string): T {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  const raw = match ? match[1] : text;
  return JSON.parse(raw.trim()) as T;
}

async function callAgent<T>(system: string, userMessage: string): Promise<T> {
  const anthropic = client();
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });
  const text = msg.content.find(b => b.type === 'text')?.text ?? '';
  return parseJSON<T>(text);
}

// Agent 1: Analyst
async function runAnalyst(tracks: LibraryTrack[]): Promise<LibraryProfile> {
  const trackData = tracks.map(t => ({
    artist: t.artist, title: t.title, bpm: t.bpm, key: t.key,
    genre: t.genre, lastfmTags: t.lastfmTags ?? [],
    seratoEnergy: t.seratoEnergy, isWishlist: t.isWishlist,
  }));
  return callAgent<LibraryProfile>(
    ANALYST_SYSTEM,
    `Analyze this library of ${tracks.length} tracks:\n\n${JSON.stringify(trackData, null, 2)}`
  );
}

// Agent 2: Gig Intel
async function runGigIntel(input: SetlistInput, profile: LibraryProfile): Promise<GigIntelReport> {
  return callAgent<GigIntelReport>(
    GIG_INTEL_SYSTEM,
    `Gig context:
- Venue: ${input.venueContext || 'Not specified'}
- Crowd: ${input.crowdContext}
- Primary genre: ${input.primaryGenre}
- Secondary genre: ${input.secondaryGenre || 'None'}
- Lineup slot: ${input.lineupSlot}
- Duration: ${input.durationMinutes} minutes
- Vibe: ${input.vibe || 'Not specified'}

Library profile:
${JSON.stringify(profile, null, 2)}`
  );
}

// Agent 3: Set Architect
async function runArchitect(input: SetlistInput, profile: LibraryProfile, intel: GigIntelReport): Promise<SetBlueprint> {
  return callAgent<SetBlueprint>(
    ARCHITECT_SYSTEM,
    `User inputs:
- Duration: ${input.durationMinutes} minutes
- Primary genre: ${input.primaryGenre}
- Secondary genre: ${input.secondaryGenre || 'None'}
- Lineup slot: ${input.lineupSlot}
- Energy arc: ${JSON.stringify(input.energyArc)}

Gig intel:
${JSON.stringify(intel, null, 2)}

Library profile:
${JSON.stringify(profile, null, 2)}`
  );
}

// Agent 4: Selector
async function runSelector(
  input: SetlistInput,
  tracks: LibraryTrack[],
  blueprint: SetBlueprint,
  intel: GigIntelReport
): Promise<SelectedTrack[]> {
  return callAgent<SelectedTrack[]>(
    SELECTOR_SYSTEM,
    `Set blueprint:
${JSON.stringify(blueprint, null, 2)}

Gig intel:
${JSON.stringify(intel, null, 2)}

User preferences:
- Wordplay theme: ${input.wordplayTheme || 'None'}
- Seed tracks: ${input.seedTracks?.join(', ') || 'None'}

Available tracks (${tracks.length} total):
${JSON.stringify(tracks, null, 2)}`
  );
}

// Agent 5: Reviewer
async function runReviewer(
  input: SetlistInput,
  selected: SelectedTrack[]
): Promise<{ tracks: GeneratedSetlist['tracks']; reviewNotes: string }> {
  return callAgent(
    REVIEWER_SYSTEM,
    `Setlist name: "${input.name || 'Untitled Set'}"
Wordplay theme: ${input.wordplayTheme || 'None'}

Proposed setlist (${selected.length} tracks):
${JSON.stringify(selected, null, 2)}`
  );
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '-' + Math.random().toString(36).slice(2, 7);
}

// Main pipeline
export async function runSetlistPipeline(
  input: SetlistInput,
  tracks: LibraryTrack[]
): Promise<GeneratedSetlist> {
  const profile = await runAnalyst(tracks);
  const intel = await runGigIntel(input, profile);
  const blueprint = await runArchitect(input, profile, intel);
  const selected = await runSelector(input, tracks, blueprint, intel);
  const reviewed = await runReviewer(input, selected);

  return {
    name: input.name || 'Untitled Set',
    tracks: reviewed.tracks,
    reviewNotes: reviewed.reviewNotes,
    shareSlug: generateSlug(input.name || 'set'),
  };
}
