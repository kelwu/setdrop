import { LibraryTrack } from '@/lib/agents/types';

export function parseRekordboxXML(text: string): LibraryTrack[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML — is this a Rekordbox XML export?');
  }

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
    const key = el.getAttribute('Tonality') || '';
    const genre = el.getAttribute('Genre') || '';
    const location = el.getAttribute('Location') || '';

    let filePath: string | undefined;
    if (location) {
      try {
        filePath = decodeURIComponent(location.replace(/^file:\/\/localhost/, ''));
      } catch {
        filePath = location;
      }
    }

    tracks.push({
      id: `rkb-${i}`,
      artist,
      title,
      bpm: parseFloat(bpmRaw) || 0,
      key,
      genre: genre || undefined,
      filePath,
      isWishlist: false,
      lastfmTags: [],
      enrichmentSource: 'serato',
    });
  });

  if (!tracks.length) {
    throw new Error('No valid tracks found — check that the file is a Rekordbox XML export');
  }

  return tracks;
}
