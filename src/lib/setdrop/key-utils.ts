const MUSICAL_TO_CAMELOT: Record<string, string> = {
  // Major → B
  'bmaj': '1B', 'cbmaj': '1B',
  'f#maj': '2B', 'gbmaj': '2B',
  'dbmaj': '3B', 'c#maj': '3B',
  'abmaj': '4B', 'g#maj': '4B',
  'ebmaj': '5B', 'd#maj': '5B',
  'bbmaj': '6B', 'a#maj': '6B',
  'fmaj': '7B',
  'cmaj': '8B',
  'gmaj': '9B',
  'dmaj': '10B',
  'amaj': '11B',
  'emaj': '12B',
  // Minor → A
  'abmin': '1A', 'g#min': '1A',
  'ebmin': '2A', 'd#min': '2A',
  'bbmin': '3A', 'a#min': '3A',
  'fmin': '4A',
  'cmin': '5A',
  'gmin': '6A',
  'dmin': '7A',
  'amin': '8A',
  'emin': '9A',
  'bmin': '10A',
  'f#min': '11A', 'gbmin': '11A',
  'c#min': '12A', 'dbmin': '12A',
};

export function toCamelot(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Already Camelot (e.g. "8A", "12B")
  if (/^\d{1,2}[ABab]$/.test(trimmed)) return trimmed.toUpperCase();

  const normalized = trimmed
    .toLowerCase()
    .replace(/[♭]/g, 'b')
    .replace(/[♯#]/g, '#')
    .replace(/\s+/g, '')
    .replace(/major/g, 'maj')
    .replace(/minor/g, 'min')
    // "Am" / "Em" / "Ebm" short minor form — key root + optional flat/sharp + trailing 'm'
    .replace(/([a-g][b#]?)m$/, '$1min')
    // "A" alone with no suffix → assume major (rare but safe fallback)
    .replace(/^([a-g][b#]?)$/, '$1maj');

  return MUSICAL_TO_CAMELOT[normalized] ?? trimmed;
}
