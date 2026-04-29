# SetDrop — Project Summary

AI-powered DJ setlist planner. Takes a DJ's Serato library, applies gig context, and generates a sequenced setlist — then exports it back to Serato as a `.crate` file.

**Live:** https://setdrop-phi.vercel.app  
**Repo:** https://github.com/kelwu/setdrop  
**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase · Vercel · Anthropic Claude API

---

## What's Been Built

### Authentication
- Email/password sign up and sign in via Supabase Auth
- Session management with HTTP-only cookies (`@supabase/ssr`)
- Protected routes: Dashboard, Builder, Library, and Output require login
- Post-login redirect to dashboard
- Sign out from nav avatar dropdown (shows user email initial)
- `/login` page matches SetDrop dark aesthetic

### Serato Library Import
- **Primary path:** Upload Serato's `database V2` binary file (`Music/_Serato_/database V2`)
  - Parsed server-side at `/api/library/parse-db`
  - Custom binary parser (same tag format as Serato's `.crate` files — 4-char tag + uint32BE length + UTF-16 BE payload)
  - Extracts: artist, title, BPM, key, genre, file path per track
  - Handles BOM stripping, `ptrk`/`tpth` path tag variants
- **Secondary path:** History CSV export from Serato (played tracks only)
  - Custom CSV parser handles quoted fields, flexible column name matching
- After import: library saved to Supabase (`serato_libraries` + `serato_tracks` tables) with batch inserts (500 tracks/batch)
- Library also cached in `localStorage` for fast client-side access
- On subsequent visits: loads from Supabase automatically
- "Saving to cloud..." indicator during upload

### AI Setlist Generation (5-Agent Pipeline)
Five Claude agents run sequentially at `/api/generate-setlist`:

1. **Analyst** — Profiles the library: genre distribution, BPM range, energy spread, top artists, gaps
2. **Gig Intel** — Researches the venue/crowd context, recommends BPM range, flags artists to avoid
3. **Architect** — Designs the set structure: phases (intro/buildup/peak/sustain/cooldown), track counts per phase, transition strategy
4. **Selector** — Picks and sequences actual tracks from the library matching each phase's energy/BPM targets
5. **Reviewer** — Audits transitions, harmonic mixing, do-not-repeat logic, overall flow

**Inputs the user configures:**
- Mix name
- Primary + secondary genre
- Vibe/descriptor
- Crowd context (Club, Lounge, Wedding, Festival, House Party, Radio, Corporate)
- Duration (30/60/90/120 min)
- Lineup slot (Opener, Middle, Headliner, Closing)
- Energy arc (5-point draggable SVG curve: Intro → Buildup → Peak → Sustain → Cooldown)
- Arc presets (Slow Burn, Peak Hour, Warm Down)
- Optional: seed tracks, SoundCloud URL, wordplay theme, venue name

**Output:** Named setlist with ordered tracks, each annotated with: why this track, transition notes, harmonic mixing notes, wordplay connection, energy level, wishlist flag.

Generated setlists are saved to Supabase `setlists` table (including full track JSON).

### Serato Crate Export
- "Export Serato Crate" button on the Output page
- Matches setlist tracks (artist + title) against the uploaded library to find file paths
- Generates a binary `.crate` file using Serato's format:
  - `vrsn` tag: `"1.0/Serato ScratchLive Crate"` (UTF-16 BE)
  - One `otrk` tag per track containing a `ptrk` tag with the file path
- Path normalization: converts Windows paths (`C:\...` → `/C:/...`), strips `file://` URI scheme, URL-decodes percent-encoded chars
- Downloads as `SetlistName.crate` — user drops it into `_Serato_/Subcrates/`
- Status banner shows matched/total track count after download

### Dashboard
- Pulls real data from Supabase on mount:
  - Serato library: total track count, last sync date
  - Recent setlists: name, genre, duration, date, track count
- Dynamic greeting ("Good Morning/Afternoon/Evening, [username]")
- Empty states with CTAs when no data yet
- Stats card: sets built this month, avg tracks/set

### Library View
- Table with all imported tracks: artist, title, BPM, key, energy
- Search by artist/title, BPM range filter
- Tab: "In Serato Library" / "Wishlist" (wishlist is planned for Spotify integration)
- Upload zone with Database V2 / History CSV tabs
- Replace or clear library

### UI / Frontend
- 6 screens: Landing, Dashboard, Builder, Output, Library, PublicShare
- Design system: `SD` token object (colors, fonts), all inline styles
- Fonts: Bebas Neue (display) + DM Mono (mono)
- Color palette: `#0A0A0A` bg, `#F5A623` amber accent, dark surfaces
- Mobile responsive: collapses grids, hides decorative SVGs, touch-friendly drag on energy arc
- SPA architecture: client-side page state, no URL routing between app screens

---

## Database Schema (Supabase / PostgreSQL)

All tables have Row-Level Security — users can only access their own rows.

| Table | Purpose |
|-------|---------|
| `users` | Auth user profile (id, email, spotify tokens when added) |
| `serato_libraries` | One row per user — library metadata (total_tracks, last_synced) |
| `serato_tracks` | Individual tracks (artist, title, bpm, key, genre, file_path) |
| `serato_crates` | Crate definitions (planned) |
| `wishlist_tracks` | Spotify-sourced tracks to download (planned) |
| `setlists` | Generated setlists with metadata + `tracks_json` column |
| `setlist_tracks` | Normalized track-per-row (for future use) |
| `gig_history` | Played gig log (planned) |

---

## File Structure

```
src/
  app/
    page.tsx                          — Root (renders SetDropApp)
    layout.tsx                        — Fonts, metadata, viewport
    login/page.tsx                    — Auth page
    api/
      auth/callback/route.ts          — Supabase PKCE code exchange
      generate-setlist/route.ts       — 5-agent pipeline endpoint
      library/parse-db/route.ts       — Serato database V2 parser endpoint
  components/setdrop/
    App.tsx                           — SPA shell, auth state, page routing
    LandingPage.tsx                   — Hero, how it works, demo
    Dashboard.tsx                     — Stats, recent sets (live Supabase data)
    SetlistBuilder.tsx                — 3-step form + energy arc + generation
    SetlistOutput.tsx                 — Tracklist, stats, crate export
    Library.tsx                       — Import + browse library
    PublicShare.tsx                   — Public setlist view (shell built)
    shared.tsx                        — Nav, SDButton, SDInput, TrackRow, EnergyArcChart, etc.
  lib/
    supabase/
      client.ts                       — Browser Supabase client
      server.ts                       — SSR Supabase client (cookies)
      types.ts                        — Auto-generated DB types
    agents/
      types.ts                        — All agent input/output interfaces
      pipeline.ts                     — Orchestrates 5 agents
      prompts.ts                      — System prompts for each agent
    setdrop/
      constants.ts                    — SD design tokens, genre/crowd/slot lists, sample data
      serato-crate.ts                 — Binary .crate file writer
      serato-db-parser.ts             — Binary database V2 parser
  middleware.ts → proxy.ts            — Session refresh on every request (Next.js 16 "proxy")
```

---

## What's NOT Built Yet (Planned)

| Feature | Notes |
|---------|-------|
| Spotify OAuth | Connect Spotify, monitor saved tracks as wishlist. Needs Spotify app review + privacy policy URL before going beyond 25 users |
| Beatport enrichment | Enrich wishlist tracks with BPM/key from Beatport |
| Last.fm enrichment | Mood/energy tags per track |
| Public share URLs | `/set/[slug]` — server-rendered public setlist page. Shell component exists |
| Do-not-repeat logic | Flag tracks played in previous sets |
| Gig history | Log played gigs, link to setlists |
| Account deletion UI | Currently requires manual request |

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
SPOTIFY_CLIENT_ID          # not yet used
SPOTIFY_CLIENT_SECRET      # not yet used
SPOTIFY_REDIRECT_URI       # not yet used
NEXT_PUBLIC_APP_URL
```
