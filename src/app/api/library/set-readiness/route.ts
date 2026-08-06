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
  durationMinutes?: number;
}

export async function POST(req: NextRequest) {
  try {
    const { primaryGenre, secondaryGenre, durationMinutes } = (await req.json()) as Body;
    if (!primaryGenre?.trim() || !durationMinutes) {
      return NextResponse.json({ error: 'primaryGenre and durationMinutes required' }, { status: 400 });
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

    // Tiny 2-column scan (genre + tags only), paged like analyze-gaps.
    const PAGE = 1000;
    const rows: Array<{ genre: string | null; lastfm_tags: unknown }> = [];
    let from = 0;
    while (true) {
      const { data: page } = await admin
        .from('serato_tracks')
        .select('genre, lastfm_tags')
        .eq('library_id', library.id)
        .eq('in_library', true)
        .range(from, from + PAGE - 1);
      if (!page?.length) break;
      rows.push(...page);
      if (page.length < PAGE) break;
      from += PAGE;
    }
    if (!rows.length) return NextResponse.json(unknownReadiness('no-library'));

    const gigSuper = superFamily(primaryGenre);
    const counts: ReadinessCounts = { exact: 0, family: 0, adjacent: 0, superFamily: 0, usable: 0 };

    for (const t of rows) {
      const genre = t.genre ?? '';
      const tags = (t.lastfm_tags as string[] | null) ?? [];

      // exact/family/adjacent + super-family use the PRIMARY genre only, mirroring
      // pipeline.ts:459-465 (so "few true-genre tracks" agrees with the backend note).
      const primary = genreRelevance(primaryGenre, genre, tags);
      if (primary.tier === 'exact') counts.exact++;
      else if (primary.tier === 'family') counts.family++;
      else if (primary.tier === 'adjacent') counts.adjacent++;
      if (gigSuper !== 'other' && superFamily(genre, tags) === gigSuper) counts.superFamily++;

      // usable uses the best of primary/secondary — mirrors filterTracksForGig's
      // genreScoreFor gate (a track survives if either genre isn't 'off').
      const secondaryScore = secondaryGenre ? genreRelevance(secondaryGenre, genre, tags).score : -1;
      if (Math.max(primary.score, secondaryScore) >= 0) counts.usable++;
    }

    const target = targetTrackCount(durationMinutes);
    const result: ReadinessResult = classifyReadiness(counts, target, gigSuper === 'other');
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[set-readiness]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
