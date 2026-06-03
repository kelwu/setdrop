import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

const BPM_BUCKETS = [
  { label: '60–79', min: 60, max: 79 },
  { label: '80–99', min: 80, max: 99 },
  { label: '100–109', min: 100, max: 109 },
  { label: '110–119', min: 110, max: 119 },
  { label: '120–127', min: 120, max: 127 },
  { label: '128–134', min: 128, max: 134 },
  { label: '135+', min: 135, max: 999 },
];

interface RawGap {
  genre: string;
  bpmRange: string;
  currentCount: number;
  severity: 'high' | 'medium' | 'low';
}

export interface GapRecommendation {
  artist: string;
  title: string;
  bpm: number;
  reason: string;
  beatportSearchUrl: string;
}

export interface LibraryGap {
  genre: string;
  bpmRange: string;
  currentCount: number;
  severity: 'high' | 'medium' | 'low';
  recommendations: GapRecommendation[];
}

function detectGaps(tracks: Array<{ bpm: number | null; genre: string | null }>): RawGap[] {
  const byGenre: Record<string, number[]> = {};
  for (const t of tracks) {
    if (!t.bpm || t.bpm < 60 || t.bpm > 220) continue;
    const genre = (t.genre ?? '').trim() || 'Unknown';
    (byGenre[genre] ??= []).push(t.bpm);
  }

  const gaps: RawGap[] = [];

  for (const [genre, bpms] of Object.entries(byGenre)) {
    if (bpms.length < 10) continue;

    // Use 10th–90th percentile range to avoid outliers defining the active range
    const sorted = [...bpms].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    const p90 = sorted[Math.min(Math.ceil(sorted.length * 0.9), sorted.length - 1)];

    const activeBuckets = BPM_BUCKETS.filter(b => b.max >= p10 && b.min <= p90);
    if (activeBuckets.length < 2) continue;

    const counts = activeBuckets.map(b => ({
      ...b,
      count: bpms.filter(bpm => bpm >= b.min && bpm <= b.max).length,
    }));

    const nonEmpty = counts.filter(c => c.count > 0);
    if (nonEmpty.length < 2) continue;

    const avgDensity = bpms.length / nonEmpty.length;

    for (const bucket of counts) {
      if (bucket.count < avgDensity * 0.3) {
        gaps.push({
          genre,
          bpmRange: bucket.label,
          currentCount: bucket.count,
          severity:
            bucket.count === 0 && avgDensity >= 15 ? 'high'
            : bucket.count === 0 ? 'medium'
            : 'low',
        });
      }
    }
  }

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  gaps.sort((a, b) => order[a.severity] - order[b.severity]);
  return gaps.slice(0, 5);
}

const GAP_TOOL: Anthropic.Tool = {
  name: 'report_library_gaps',
  description: 'Report DJ library gaps with specific track recommendations from web research.',
  input_schema: {
    type: 'object',
    required: ['gaps'],
    properties: {
      gaps: {
        type: 'array',
        items: {
          type: 'object',
          required: ['genre', 'bpmRange', 'currentCount', 'severity', 'recommendations'],
          properties: {
            genre: { type: 'string' },
            bpmRange: { type: 'string' },
            currentCount: { type: 'number' },
            severity: { type: 'string', enum: ['high', 'medium', 'low'] },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                required: ['artist', 'title', 'bpm', 'reason', 'beatportSearchUrl'],
                properties: {
                  artist: { type: 'string' },
                  title: { type: 'string' },
                  bpm: { type: 'number' },
                  reason: { type: 'string' },
                  beatportSearchUrl: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
};

const WEB_SEARCH: Anthropic.Messages.WebSearchTool20260209 = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 3,
  allowed_domains: [
    'www.beatport.com', 'www.djcity.com', 'www.bpmsupreme.com',
    'www.billboard.com', 'www.audiomack.com', 'ra.co', 'djmag.com',
  ],
};

const SYSTEM = `You are a DJ library gap analyst. You receive a list of BPM/genre gaps in a DJ's library.

For each gap, use web search to find 3 specific trending tracks in that genre and BPM range. Use the most relevant source per genre:

- House / Tech House / Afro House / Deep House → Beatport Top 100 (genre chart)
- Techno / Minimal / Industrial → Beatport Top 100 Techno
- Drum & Bass → Beatport Top 100 Drum & Bass
- Hip Hop / Trap / Drill → DJcity charts or Billboard Hot Rap Songs
- R&B / Soul → Billboard Hot R&B/Hip-Hop or DJcity R&B
- Pop / Dance Pop / Top 40 → Billboard Hot 100
- Latin / Reggaeton → Billboard Latin Charts
- Afrobeats / Dancehall → Audiomack Trending or Apple Music Afrobeats
- EDM / Big Room / Mainstage → Beatport Top 100 Big Room or Billboard Dance/Electronic

Find real, specific artist and title pairs in the correct BPM range. Then call report_library_gaps with all gaps filled in.
For beatportSearchUrl use: https://www.beatport.com/search?q=ARTIST+TITLE (URL-encode artist and title, replace spaces with +).`;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();

    const { data: library } = await admin
      .from('serato_libraries')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!library) return NextResponse.json({ error: 'No library found' }, { status: 404 });

    const { data: tracks } = await admin
      .from('serato_tracks')
      .select('bpm, genre')
      .eq('library_id', library.id)
      .eq('in_library', true);

    if (!tracks?.length) return NextResponse.json({ error: 'Library is empty' }, { status: 404 });

    const rawGaps = detectGaps(tracks);
    const genresAnalyzed = new Set(tracks.filter(t => t.genre).map(t => t.genre)).size;
    const meta = { tracksAnalyzed: tracks.length, genresAnalyzed };

    if (!rawGaps.length) return NextResponse.json({ gaps: [], meta });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const userMsg = `Library gaps detected:\n${JSON.stringify(rawGaps, null, 2)}\n\nSearch for 3 trending tracks per gap and call report_library_gaps.`;

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
      tools: [WEB_SEARCH, GAP_TOOL],
      tool_choice: { type: 'auto' },
    });

    const toolBlock = msg.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'report_library_gaps',
    );

    if (toolBlock) {
      return NextResponse.json({ gaps: (toolBlock.input as { gaps: LibraryGap[] }).gaps, meta });
    }

    // Model did web searches but didn't call the tool yet — force it
    const forced = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        { role: 'user', content: userMsg },
        { role: 'assistant', content: msg.content as unknown as Anthropic.Messages.ContentBlockParam[] },
        { role: 'user', content: 'Now call report_library_gaps with your recommendations.' },
      ],
      tools: [GAP_TOOL],
      tool_choice: { type: 'tool', name: 'report_library_gaps' },
    });

    const block = forced.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
    );
    if (!block) throw new Error('No tool_use block from forced call');

    return NextResponse.json({ gaps: (block.input as { gaps: LibraryGap[] }).gaps, meta });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[analyze-gaps]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
