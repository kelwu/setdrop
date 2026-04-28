import { LibraryTrack } from '@/lib/agents/types';

function decodeUtf16BE(buf: Buffer): string {
  const len = buf.length & ~1; // round down to even
  const swapped = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i += 2) {
    swapped[i]     = buf[i + 1];
    swapped[i + 1] = buf[i];
  }
  return swapped.toString('utf16le');
}

interface SubTags {
  filePath?: string;
  title?: string;
  artist?: string;
  bpmStr?: string;
  key?: string;
  genre?: string;
}

function walkTags(buf: Buffer): Map<string, Buffer[]> {
  const tags = new Map<string, Buffer[]>();
  let pos = 0;
  while (pos + 8 <= buf.length) {
    const name = buf.toString('ascii', pos, pos + 4);
    const length = buf.readUInt32BE(pos + 4);
    pos += 8;
    if (pos + length > buf.length) break;
    const payload = buf.subarray(pos, pos + length);
    pos += length;
    if (!tags.has(name)) tags.set(name, []);
    tags.get(name)!.push(payload);
  }
  return tags;
}

function parseOtrk(payload: Buffer): SubTags {
  const tags = walkTags(payload);
  const str = (name: string) => {
    const bufs = tags.get(name);
    return bufs?.length ? decodeUtf16BE(bufs[0]) : undefined;
  };
  // prefer tpth (newer) over ptrk for file path
  const filePath = str('tpth') ?? str('ptrk');
  return {
    filePath,
    title:  str('tsng'),
    artist: str('tart'),
    bpmStr: str('tbpm'),
    key:    str('tkey'),
    genre:  str('tgen'),
  };
}

export function parseSeratoDatabase(buffer: Buffer): LibraryTrack[] {
  let buf = buffer;

  // Strip leading BOM if present (UTF-8: EF BB BF, UTF-16 LE: FF FE)
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    buf = buf.subarray(3);
  } else if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    buf = buf.subarray(2);
  }

  const topTags = walkTags(buf);
  const otrkList = topTags.get('otrk') ?? [];

  const tracks: LibraryTrack[] = [];
  for (let i = 0; i < otrkList.length; i++) {
    const { filePath, title, artist, bpmStr, key, genre } = parseOtrk(otrkList[i]);
    if (!artist && !title) continue;
    tracks.push({
      id: `db-${i}`,
      artist: artist ?? '',
      title:  title  ?? '',
      bpm:    parseFloat(bpmStr ?? '0') || 0,
      key:    key    ?? '',
      genre:  genre  ?? undefined,
      filePath: filePath ?? undefined,
      isWishlist: false,
      lastfmTags: [],
      enrichmentSource: 'serato',
    });
  }

  if (tracks.length === 0) {
    throw new Error('No tracks found — is this a Serato database V2 file?');
  }

  return tracks;
}
