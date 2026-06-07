// Mix Scanner — client-side chunking of a long audio file for Track ID v2.
//
// The standard ACRCloud /v1/identify endpoint takes one ~10s sample and
// returns ONE matched track. To get a timestamped tracklist of a DJ mix,
// we sample the audio at intervals and call the endpoint per chunk.
//
// All decoding and chunking happens in the browser (Web Audio API), so
// the server side stays simple — each chunk reuses the existing
// /api/track-id endpoint exactly as a single Track ID would.

export interface ScanChunk {
  /** Seconds from the start of the mix where this chunk begins. */
  timestamp: number;
  /** ~10s of audio encoded as a WAV Blob, ready to POST. */
  blob: Blob;
}

export interface ScanProgress {
  done: number;
  total: number;
  currentTimestamp: number;
}

export const SAMPLE_INTERVAL_SECONDS = 45;
export const SAMPLE_LENGTH_SECONDS = 10;
export const MAX_CONCURRENT_REQUESTS = 3;

/** Decode an uploaded audio file and slice it into scannable chunks. */
export async function chunkMix(file: File): Promise<{
  chunks: ScanChunk[];
  durationSec: number;
}> {
  // Web Audio's decodeAudioData needs an ArrayBuffer copy
  const arrayBuffer = await file.arrayBuffer();
  // AudioContext is the standard decoder; OfflineAudioContext would be
  // marginally faster but doesn't add value for a one-shot decode.
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close().catch(() => { /* not critical */ });

  const durationSec = audioBuffer.duration;
  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;

  const chunks: ScanChunk[] = [];
  for (let t = 0; t + SAMPLE_LENGTH_SECONDS <= durationSec; t += SAMPLE_INTERVAL_SECONDS) {
    const startFrame = Math.floor(t * sampleRate);
    const endFrame = Math.floor((t + SAMPLE_LENGTH_SECONDS) * sampleRate);
    const frameCount = endFrame - startFrame;

    // Pull the slice for each channel
    const channelSlices: Float32Array[] = [];
    for (let c = 0; c < channels; c++) {
      const ch = audioBuffer.getChannelData(c);
      channelSlices.push(ch.slice(startFrame, endFrame));
    }

    const wav = encodeWav(channelSlices, sampleRate, frameCount);
    chunks.push({
      timestamp: t,
      blob: new Blob([wav], { type: 'audio/wav' }),
    });
  }

  return { chunks, durationSec };
}

/** Encode raw Float32 channel data as a 16-bit PCM WAV file. */
function encodeWav(channels: Float32Array[], sampleRate: number, frameCount: number): ArrayBuffer {
  const numChannels = channels.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;
  const totalSize = 44 + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);        // PCM chunk size
  view.setUint16(20, 1, true);         // audio format = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);        // bits per sample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels and convert Float32 (-1..1) to Int16
  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

/** Identify-one-chunk against the existing /api/track-id endpoint. */
async function identifyChunk(chunk: ScanChunk, mixSessionId: string): Promise<{
  timestamp: number;
  matched: boolean;
  candidates: MixCandidate[];
}> {
  const form = new FormData();
  form.append('audio', chunk.blob, 'chunk.wav');
  form.append('source', 'upload');
  form.append('mixSessionId', mixSessionId);
  form.append('mixTimestamp', String(chunk.timestamp));

  const res = await fetch('/api/track-id', { method: 'POST', body: form });
  if (res.status === 429) {
    throw new Error('quota_exhausted');
  }
  if (!res.ok) {
    return { timestamp: chunk.timestamp, matched: false, candidates: [] };
  }
  const data = await res.json() as {
    matched: boolean;
    candidates: MixCandidate[];
  };
  return {
    timestamp: chunk.timestamp,
    matched: data.matched,
    candidates: data.candidates,
  };
}

export interface MixCandidate {
  artist: string;
  title: string;
  bpm: number | null;
  genre: string | null;
  confidence: number;
  beatportSearchUrl: string;
}

export interface MixSegmentMatch {
  timestamp: number;
  artist: string;
  title: string;
  bpm: number | null;
  genre: string | null;
  confidence: number;
  beatportSearchUrl: string;
}

/**
 * Scan all chunks with bounded concurrency, calling onProgress as each
 * completes. Returns a deduplicated timeline of segments (one entry per
 * detected track, with its earliest timestamp).
 */
export async function scanChunks(
  chunks: ScanChunk[],
  mixSessionId: string,
  onProgress: (p: ScanProgress) => void,
): Promise<MixSegmentMatch[]> {
  const results: { timestamp: number; candidates: MixCandidate[] }[] = [];
  let done = 0;

  // Simple bounded-concurrency runner
  let next = 0;
  async function worker() {
    while (next < chunks.length) {
      const idx = next++;
      const chunk = chunks[idx];
      onProgress({ done, total: chunks.length, currentTimestamp: chunk.timestamp });
      const r = await identifyChunk(chunk, mixSessionId);
      results.push({ timestamp: r.timestamp, candidates: r.matched ? r.candidates : [] });
      done++;
      onProgress({ done, total: chunks.length, currentTimestamp: chunk.timestamp });
    }
  }
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, chunks.length) }, () => worker());
  await Promise.all(workers);

  // Sort by timestamp ascending
  results.sort((a, b) => a.timestamp - b.timestamp);

  // Dedupe consecutive matches of the same track — keep the earliest timestamp
  const segments: MixSegmentMatch[] = [];
  let lastKey = '';
  for (const r of results) {
    const top = r.candidates[0];
    if (!top) continue;
    const key = `${top.artist.toLowerCase()}|${top.title.toLowerCase()}`;
    if (key === lastKey) continue;
    lastKey = key;
    segments.push({
      timestamp: r.timestamp,
      artist: top.artist,
      title: top.title,
      bpm: top.bpm,
      genre: top.genre,
      confidence: top.confidence,
      beatportSearchUrl: top.beatportSearchUrl,
    });
  }
  return segments;
}

/** Mm:ss formatter for the timeline display. */
export function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
