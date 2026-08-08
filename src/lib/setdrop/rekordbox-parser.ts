import { LibraryTrack } from '@/lib/agents/types';
import { toCamelot } from './key-utils';

/** Canonical library key for a track. MUST stay byte-identical to the dedup key in
 *  library-save.ts (which imports this) so playlist membership resolves to real rows. */
export function trackKey(artist: string, title: string): string {
  return `${(artist ?? '').toLowerCase().trim()}|${(title ?? '').toLowerCase().trim()}`;
}

export interface RekordboxPlaylist {
  name: string;
  trackKeys: string[]; // normalized "artist|title" keys (see trackKey)
}

function parseDocument(text: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML — is this a Rekordbox XML export?');
  }
  return doc;
}

function parseTracksFromDoc(doc: Document): LibraryTrack[] {
  const trackEls = doc.querySelectorAll('COLLECTION > TRACK');
  if (!trackEls.length) {
    throw new Error('No tracks found in COLLECTION — is this a Rekordbox XML export?');
  }

  const tracks: LibraryTrack[] = [];
  trackEls.forEach((el, i) => {
    const artist = el.getAttribute('Artist') || '';
    const title = el.getAttribute('Name') || '';
    if (!artist && !title) return;

    const bpmRaw = el.getAttribute('AverageBpm') || el.getAttribute('Bpm') || '0';
    const key = toCamelot(el.getAttribute('Tonality') || '');
    const genre = el.getAttribute('Genre') || '';
    const location = el.getAttribute('Location') || '';
    const yearRaw = el.getAttribute('Year') || '';

    let filePath: string | undefined;
    if (location) {
      try {
        // macOS Rekordbox: file://localhost/Users/... → /Users/...
        // Windows Rekordbox: file:///C:/...           → /C:/...
        // Generic file URI:  file:///Users/...        → /Users/...
        const stripped = location
          .replace(/^file:\/\/localhost/, '')
          .replace(/^file:\/\/\//, '/');
        filePath = decodeURIComponent(stripped);
      } catch {
        filePath = location;
      }
    }

    const yearParsed = yearRaw ? parseInt(yearRaw.slice(0, 4), 10) : undefined;
    tracks.push({
      id: `rkb-${i}`,
      artist,
      title,
      bpm: parseFloat(bpmRaw) || 0,
      key,
      genre: genre || undefined,
      year: yearParsed && yearParsed > 1900 && yearParsed < 2100 ? yearParsed : undefined,
      filePath,
      isWishlist: false,
      lastfmTags: [],
      enrichmentSource: 'rekordbox',
    });
  });

  if (!tracks.length) {
    throw new Error('No valid tracks found — check that the file is a Rekordbox XML export');
  }

  return tracks;
}

// Walk the <NODE> tree depth-first. Type="0" = folder (recurse), Type="1" = playlist.
// Rekordbox references tracks by TrackID (KeyType="0", the default export format);
// unresolved keys (e.g. the rare KeyType="1" location form) are simply skipped.
function collectPlaylists(
  node: Element,
  idToTrack: Map<string, { artist: string; title: string }>,
  out: RekordboxPlaylist[],
): void {
  for (const child of Array.from(node.children)) {
    if (child.tagName !== 'NODE') continue;
    if (child.getAttribute('Type') === '1') {
      const name = (child.getAttribute('Name') || 'Untitled Playlist').trim();
      const keys: string[] = [];
      const seen = new Set<string>();
      for (const tr of Array.from(child.children)) {
        if (tr.tagName !== 'TRACK') continue;
        const id = tr.getAttribute('Key');
        if (!id) continue;
        const t = idToTrack.get(id);
        if (!t) continue;
        const k = trackKey(t.artist, t.title);
        if (seen.has(k)) continue;
        seen.add(k);
        keys.push(k);
      }
      if (keys.length) out.push({ name, trackKeys: keys });
    } else {
      collectPlaylists(child, idToTrack, out);
    }
  }
}

function parsePlaylistsFromDoc(doc: Document): RekordboxPlaylist[] {
  const root = doc.querySelector('PLAYLISTS > NODE');
  if (!root) return [];

  const idToTrack = new Map<string, { artist: string; title: string }>();
  doc.querySelectorAll('COLLECTION > TRACK').forEach(el => {
    const id = el.getAttribute('TrackID');
    if (!id) return;
    idToTrack.set(id, {
      artist: el.getAttribute('Artist') || '',
      title: el.getAttribute('Name') || '',
    });
  });

  const out: RekordboxPlaylist[] = [];
  collectPlaylists(root, idToTrack, out);
  return out;
}

export function parseRekordboxXML(text: string): LibraryTrack[] {
  return parseTracksFromDoc(parseDocument(text));
}

export function parseRekordboxPlaylists(text: string): RekordboxPlaylist[] {
  return parsePlaylistsFromDoc(parseDocument(text));
}

/** Parse tracks + playlists in a single pass (the XML is only parsed once). */
export function parseRekordboxLibrary(text: string): {
  tracks: LibraryTrack[];
  playlists: RekordboxPlaylist[];
} {
  const doc = parseDocument(text);
  return { tracks: parseTracksFromDoc(doc), playlists: parsePlaylistsFromDoc(doc) };
}
