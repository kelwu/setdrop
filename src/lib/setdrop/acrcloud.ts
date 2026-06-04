import crypto from 'crypto';

interface AcrCloudMusicItem {
  title?: string;
  artists?: Array<{ name: string }>;
  album?: { name: string };
  genres?: Array<{ name: string }>;
  release_date?: string;
  bpm_range?: { min: number; max: number };
  score?: number;
  external_metadata?: {
    beatport?: { track?: { id: number } };
    spotify?: { track?: { id: string } };
  };
}

interface AcrCloudResponse {
  status: { code: number; msg: string };
  metadata?: { music?: AcrCloudMusicItem[] };
}

export interface AcrCloudMatch {
  title: string;
  artist: string;
  genre: string | null;
  releaseDate: string | null;
  bpm: number | null;
  confidence: number;
  externalMatchId: string | null;
  beatportSearchUrl: string;
}

export interface AcrCloudResult {
  matched: boolean;
  candidates: AcrCloudMatch[];
}

export async function identifyAudio(audioBuffer: Buffer): Promise<AcrCloudResult> {
  const host = process.env.ACRCLOUD_HOST ?? 'identify-eu-west-1.acrcloud.com';
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY ?? '';
  const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET ?? '';

  if (!accessKey || !accessSecret) throw new Error('ACRCloud credentials not configured — set ACRCLOUD_ACCESS_KEY and ACRCLOUD_ACCESS_SECRET');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = ['POST', '/v1/identify', accessKey, 'audio', '1', timestamp].join('\n');
  const signature = crypto.createHmac('sha1', accessSecret).update(stringToSign).digest('base64');

  const form = new FormData();
  form.append('sample', new Blob([new Uint8Array(audioBuffer)]), 'audio.webm');
  form.append('access_key', accessKey);
  form.append('data_type', 'audio');
  form.append('signature_version', '1');
  form.append('signature', signature);
  form.append('sample_bytes', audioBuffer.length.toString());
  form.append('timestamp', timestamp);

  const res = await fetch(`https://${host}/v1/identify`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`ACRCloud request failed: ${res.status}`);

  const data = await res.json() as AcrCloudResponse;

  // code 0 = success, 1001 = no result
  if (data.status.code !== 0 || !data.metadata?.music?.length) {
    return { matched: false, candidates: [] };
  }

  const candidates: AcrCloudMatch[] = data.metadata.music.slice(0, 3).map(m => {
    const title = m.title ?? 'Unknown';
    const artist = m.artists?.map(a => a.name).join(', ') ?? 'Unknown';
    const q = encodeURIComponent(`${artist} ${title}`);
    const bpmRaw = m.bpm_range;
    return {
      title,
      artist,
      genre: m.genres?.[0]?.name ?? null,
      releaseDate: m.release_date ?? null,
      bpm: bpmRaw ? Math.round((bpmRaw.min + bpmRaw.max) / 2) : null,
      confidence: m.score ?? 0,
      externalMatchId: m.external_metadata?.beatport?.track?.id?.toString() ?? null,
      beatportSearchUrl: `https://www.beatport.com/search?q=${q}`,
    };
  });

  return { matched: true, candidates };
}
