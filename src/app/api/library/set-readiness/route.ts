import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { genreRelevance, superFamily } from '@/lib/setdrop/genre';
import {
  classifyReadiness, targetTrackCount, unknownReadiness,
  type ReadinessCounts, type ReadinessResult,
} from '@/lib/setdrop/readiness';

// Pre-generation "set readiness" check: how many library tracks qualify for the
// selected genre(s), judged against the set size for the chosen duration. Pure
// code-only count — no LLM, no web search — so it's cheap to call (debounced) as
// the DJ changes genre/duration on the builder. Mirrors the counting logic in
// pipeline.ts (runSetlistPipeline) + filterTracksForGig so the pre-gen hint and
// the backend agree. Deliberately does NOT record usage: it's a read, not a
// billable action, and runs on every debounced change.
export const runtime = 'nodejs';
export const maxDuration = 30;

interface Body {
  primaryGenre?: string;
  secondaryGenre?: string;
  eras?: number[];
  artists?: string[];
  durationMinutes?: number;
}

export async function POST(req: NextRequest) {
  try {
    const { primaryGenre, secondaryGenre, eras, artists, durationMinutes } = (await req.json()) as Body;
    const genreActive = !!primaryGenre?.trim();
    const eraSet = new Set(eras ?? []);
    const eraActive = eraSet.size > 0;
    const anchors = (artists ?? []).map(a => a.toLowerCase().trim()).filter(Boolean);
    const artistActive = anchors.length > 0;
    if ((!genreActive && !eraActive && !artistActive) || !durationMinutes) {
      return NextResponse.json({ error: 'durationMinutes and at least one axis (genre, era, or artist) required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    // No auth → builder still works on the demo library; readiness is just unknown.
    if (!user) return NextResponse.json(unknownReadiness('no-auth'));

    const admin = createAdminClient();
    const { data: library } = await admin
      .from('serato_libraries')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!library) return NextResponse.json(unknownReadiness('no-library'));

    // Tiny scan (genre + tags + year + artist), paged like analyze-gaps.
    const PAGE = 1000;
    const rows: Array<{ genre: string | null; lastfm_tags: unknown; year: number | null; artist: string | null }> = [];
    let from = 0;
    while (true) {
      const { data: page } = await admin
        .from('serato_tracks')
        .select('genre, lastfm_tags, year, artist')
        .eq('library_id', library.id)
        .eq('in_library', true)
        .range(from, from + PAGE - 1);
      if (!page?.length) break;
      rows.push(...page);
      if (page.length < PAGE) break;
      from += PAGE;
    }
    if (!rows.length) return NextResponse.json(unknownReadiness('no-library'));

    const gigSuper = genreActive ? superFamily(primaryGenre!) : 'other';
    const counts: ReadinessCounts = { exact: 0, family: 0, adjacent: 0, superFamily: 0, usable: 0, withYear: 0, poolTotal: 0 };

    for (const t of rows) {
      const genre = t.genre ?? '';
      const tags = (t.lastfm_tags as string[] | null) ?? [];

      // Genre-tier counts (primary genre only) — mirror the pipeline honesty note.
      // Only meaningful when a genre axis is active.
      if (genreActive) {
        const primary = genreRelevance(primaryGenre!, genre, tags);
        if (primary.tier === 'exact') counts.exact++;
        else if (primary.tier === 'family') counts.family++;
        else if (primary.tier === 'adjacent') counts.adjacent++;
        if (gigSuper !== 'other' && superFamily(genre, tags) === gigSuper) counts.superFamily++;
      }

      // Combined-pool membership — must pass every active axis, mirroring
      // filterTracksForGig + the pipeline gate.
      if (eraActive && !(t.year != null && eraSet.has(Math.floor(t.year / 10) * 10))) continue;
      if (artistActive && !anchors.some(a => (t.artist ?? '').toLowerCase().includes(a))) continue;
      counts.poolTotal++;
      if (genreActive) {
        const primaryScore = genreRelevance(primaryGenre!, genre, tags).score;
        const secondaryScore = secondaryGenre ? genreRelevance(secondaryGenre, genre, tags).score : -1;
        if (Math.max(primaryScore, secondaryScore) < 0) continue; // 'off' from both → excluded
      }
      counts.usable++;
      if (t.year != null) counts.withYear++;
    }

    const target = targetTrackCount(durationMinutes);
    const result: ReadinessResult = classifyReadiness(counts, target, gigSuper === 'other', { genreActive, eraActive });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[set-readiness]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
