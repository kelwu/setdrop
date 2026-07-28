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

// Parses a Camelot key like "8A" into { num: 8, letter: 'A' }, or null if it
// isn't valid Camelot notation.
function parseCamelot(raw: string): { num: number; letter: 'A' | 'B' } | null {
  const c = toCamelot(raw);
  const m = /^(\d{1,2})([AB])$/.exec(c);
  if (!m) return null;
  const num = Number(m[1]);
  if (num < 1 || num > 12) return null;
  return { num, letter: m[2] as 'A' | 'B' };
}

export interface CamelotRelation {
  steps: number;       // ring distance of the numbers (0-6); -1 when a key is unknown
  compatible: boolean; // true for same key / adjacent / relative
  label: string;       // short, accurate, DJ-facing description of the move
}

/**
 * The harmonic relationship between two keys on the Camelot wheel — computed, not
 * guessed. Use for `harmonicMixingNotes` so the numbers are always correct.
 */
export function camelotRelation(fromRaw: string, toRaw: string): CamelotRelation {
  const a = parseCamelot(fromRaw);
  const b = parseCamelot(toRaw);
  if (!a || !b) {
    return { steps: -1, compatible: false, label: 'key unknown — mix by ear / percussively' };
  }
  const diff = Math.abs(a.num - b.num);
  const d = Math.min(diff, 12 - diff); // ring distance (0-6)
  const sameLetter = a.letter === b.letter;

  if (d === 0 && sameLetter) return { steps: 0, compatible: true, label: 'same key — seamless blend' };
  if (d === 0 && !sameLetter) return { steps: 0, compatible: true, label: 'relative major/minor — smooth' };
  if (d === 1 && sameLetter) return { steps: 1, compatible: true, label: 'adjacent — energy-boost blend' };
  if (d === 1) return { steps: 1, compatible: false, label: '1 step across scales — workable with an EQ swap' };
  if (d === 2) return { steps: 2, compatible: false, label: '2 steps — bridge with an EQ / percussive blend' };
  return {
    steps: d,
    compatible: false,
    label: `${d}-step clash — don't blend harmonically; use a percussive or acapella bridge, or a stepping-stone track`,
  };
}
