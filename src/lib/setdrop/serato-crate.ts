// Serato crate binary format writer
// Format: tag-based structure with 4-char type + uint32BE length + payload
// Strings are UTF-16 Big Endian, no BOM

function encodeUtf16BE(str: string): Uint8Array {
  const out = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out[i * 2]     = (code >>> 8) & 0xFF;
    out[i * 2 + 1] = code & 0xFF;
  }
  return out;
}

function writeTag(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  for (let i = 0; i < 4; i++) out[i] = type.charCodeAt(i);
  const len = payload.length;
  out[4] = (len >>> 24) & 0xFF;
  out[5] = (len >>> 16) & 0xFF;
  out[6] = (len >>> 8)  & 0xFF;
  out[7] = len & 0xFF;
  out.set(payload, 8);
  return out;
}

// Normalize file path to Serato's internal format
// Serato stores paths as /C:/Users/... on Windows and /Users/... on Mac
function toSeratoPath(raw: string): string {
  let path = raw.trim();

  // Strip file:// URI scheme
  if (path.startsWith('file:///')) path = path.slice(7);       // → /C:/...
  else if (path.startsWith('file://')) path = path.slice(6);   // → /path

  // URL-decode percent-encoded chars
  try { path = decodeURIComponent(path); } catch { /* leave as-is */ }

  // Windows absolute path: C:\Users\... → /C:/Users/...
  if (/^[A-Za-z]:[/\\]/.test(path)) {
    path = '/' + path.replace(/\\/g, '/');
  }

  return path;
}

export function buildCrate(rawPaths: string[]): Uint8Array {
  const parts: Uint8Array[] = [
    writeTag('vrsn', encodeUtf16BE('1.0/Serato ScratchLive Crate')),
  ];

  for (const raw of rawPaths) {
    const path = toSeratoPath(raw);
    const ptrk = writeTag('ptrk', encodeUtf16BE(path));
    parts.push(writeTag('otrk', ptrk));
  }

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}

export function downloadCrate(data: Uint8Array, name: string): void {
  const safe = name.replace(/[<>:"/\\|?*]/g, '').trim() || 'SetDrop';
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}.crate`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
