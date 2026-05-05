import { LibraryTrack } from '@/lib/agents/types';
import { SetlistTrack } from '@/lib/agents/types';

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Exact normalized match first; fuzzy fallback handles AI-added "feat. X" or minor title differences
function findLibraryTrack(artist: string, title: string, library: LibraryTrack[]): LibraryTrack | undefined {
  const na = normalize(artist);
  const nt = normalize(title);
  const exact = library.find(l => normalize(l.artist) === na && normalize(l.title) === nt);
  if (exact) return exact;
  return library.find(l => {
    const la = normalize(l.artist);
    const lt = normalize(l.title);
    const artistMatch = la === na || la.startsWith(na) || na.startsWith(la);
    const titleMatch = lt === nt || lt.startsWith(nt) || nt.startsWith(lt);
    return artistMatch && titleMatch;
  });
}

function toRekordboxLocation(filePath: string): string {
  let path = filePath.trim();
  if (path.startsWith('file://')) {
    return path.replace(/ /g, '%20');
  }
  // Windows absolute path: C:\... → /C:/...
  if (/^[A-Za-z]:[/\\]/.test(path)) {
    path = '/' + path.replace(/\\/g, '/');
  }
  // Bare relative path (e.g. pfil on macOS): Users/... → /Users/...
  if (!path.startsWith('/')) path = '/' + path;
  return 'file://' + path.replace(/ /g, '%20');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildRekordboxXml(
  setlistName: string,
  tracks: SetlistTrack[],
  library: LibraryTrack[],
): { xml: string; matched: number } {
  // Match setlist tracks to library file paths
  const matched: Array<{ track: SetlistTrack; filePath: string; id: number }> = [];
  let idCounter = 1;

  for (const t of tracks) {
    const found = findLibraryTrack(t.artist, t.title, library);
    if (found) {
      matched.push({ track: t, filePath: found.filePath ?? '', id: idCounter++ });
    }
  }

  const collectionEntries = matched.map(({ track, filePath, id }) => {
    const location = toRekordboxLocation(filePath);
    return `    <TRACK TrackID="${id}" Name="${escapeXml(track.title)}" Artist="${escapeXml(track.artist)}" `
      + `TotalTime="0" DiscNumber="0" TrackNumber="0" Year="" Genre="" Album="" `
      + `AverageBpm="${track.bpm.toFixed(2)}" Comments="" Rating="0" `
      + `Location="${escapeXml(location)}" Remixer="" Tonality="${escapeXml(track.key)}" `
      + `Label="" Mix=""/>`;
  }).join('\n');

  const playlistTracks = matched
    .map(({ id }) => `        <TRACK Key="${id}"/>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rekordbox" Version="6.0.0" Company="AlphaTheta"/>
  <COLLECTION Entries="${matched.length}">
${collectionEntries}
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT">
      <NODE Name="${escapeXml(setlistName)}" Type="1" Count="${matched.length}">
${playlistTracks}
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>`;

  return { xml, matched: matched.length };
}

export function downloadRekordboxXml(xml: string, name: string): void {
  const safe = name.replace(/[<>:"/\\|?*]/g, '').trim() || 'SetDrop';
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
