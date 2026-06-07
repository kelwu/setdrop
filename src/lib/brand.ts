// Single source of truth for the app's brand name.
//
// To rename the app: update the constants here and the vast majority of
// user-visible occurrences swap automatically. After updating, also handle
// the external services that aren't owned by this constant:
//   - Domain (NEXT_PUBLIC_APP_URL env var + DNS + SSL)
//   - GitHub repo name + URL
//   - Vercel project name
//   - Supabase project name (cosmetic — IDs don't change)
//   - Stripe product names
//   - ACRCloud project name
//   - Resend "from" email and templates
//   - Filenames: setdrop-context.md, setdrop-build-brief.md, track-id-build-spec.md
//
// Internal abbreviations that are NOT user-visible are deliberately kept as
// legacy and don't need renaming:
//   - The `SD` token object in constants.ts
//   - CSS prefix `sd-*` (sd-pad-x, sd-grid-2, etc.)
//   - localStorage / sessionStorage keys (sd_library, sd_builder_prefill, etc.)
//   - The `src/lib/setdrop/` directory path
//   - Console log tags like '[track-id]', '[trending]'
export const BRAND = {
  // Plain name used in body text, share copy, etc.
  name: 'SetDrop',
  // ALL CAPS variant used in display headings and the share-page H1
  nameAllCaps: 'SETDROP',
  // Split-color logo pattern: `logoLeft` rendered in default text + `logoRight` in accent
  logoLeft: 'SET',
  logoRight: 'DROP',
  // Bare domain (no protocol) — used in invoice footer, share-page footer
  domain: 'setdrop.app',
  // One-line tagline for OG / metadata / email signatures
  tagline: 'AI for DJ setlist planning',
} as const;
