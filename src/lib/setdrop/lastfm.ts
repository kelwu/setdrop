// Last.fm API helpers. Server-only (reads LASTFM_API_KEY). Kept separate from the
// enrich-lastfm route so the setlist pipeline can reuse similar-artist lookups.

/**
 * artist.getSimilar — returns similar artist names, most-similar first.
 * Powers the artist-anchored set's automatic top-up: when a DJ's chosen artist
 * doesn't have enough tracks to fill a set, we widen to these similar artists.
 * Returns [] on any failure (no key, network, rate limit) so callers degrade
 * gracefully to the anchor-only pool.
 */
export async function getSimilarArtists(artist: string, limit = 20): Promise<string[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey || !artist.trim()) return [];
  const params = new URLSearchParams({
    method: 'artist.getSimilar',
    artist,
    api_key: apiKey,
    format: 'json',
    autocorrect: '1',
    limit: String(limit),
  });
  try {
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data?.similarartists?.artist;
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];
    return list
      .map((a: { name?: string }) => (a?.name ?? '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
