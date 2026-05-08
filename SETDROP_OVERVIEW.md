# SetDrop — Full Product & Technical Overview

> Feed this document to Claude Chat to get accurate help with the codebase, plan new features, or debug issues. Last updated: May 2026 (updated with mobile layout, setlist renaming, regenerate-with-context, genre-aware store ordering, Stripe error handling).

---

## What Is SetDrop

SetDrop is an AI-powered DJ setlist planning tool. A DJ uploads their music library, sets a gig context (genre, crowd, energy arc, duration, lineup slot), and the AI selects tracks from their library, sequences them with harmonic mixing rules, and exports the result as a Serato crate file or Rekordbox XML playlist.

**Target user:** Working DJs who play Serato DJ Pro or Rekordbox and want intelligent, context-aware set planning rather than manual curation.

**Business model:** Freemium SaaS. Free tier = 5 sets per 30 days. Pro tier = 50 sets per 30 days, $X/month billed via Stripe. Beta testers can be allowlisted via env var to bypass rate limits.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) — **non-standard version with breaking changes** |
| Language | TypeScript |
| Styling | Inline styles throughout (no Tailwind, no CSS modules) |
| Auth | Supabase Auth — Google OAuth only |
| Database | Supabase (Postgres) |
| AI | Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` |
| Payments | Stripe v22.1.0 (`stripe` npm package) — subscriptions + Customer Portal |
| Deployment | Vercel (serverless functions, `maxDuration: 300`) |
| Package notable | `jsonrepair` — used to recover malformed LLM JSON output |

---

## Design System

All design tokens live in `src/lib/setdrop/constants.ts` under the `SD` object:

```ts
SD.bg          // #0A0A0A — page background
SD.surface     // #141414 — card background
SD.accent      // #F5A623 — amber — primary CTA / highlight color
SD.text        // #F0F0F0 — primary text
SD.textSec     // #8A8A8A — secondary text
SD.textMuted   // #4A4A4A — muted/label text
SD.mono        // monospace font var
SD.display     // display font var
SD.green       // #3ECF8E — success / in-library indicator
SD.border      // rgba(255,255,255,0.07) — subtle border
```

Shared UI components live in `src/components/setdrop/shared.tsx`: `SDButton`, `SDInput`, `TrackRow`, `EnergyArcChart`, `GenrePillSelector`, `ConfidenceBadge`, `EnergyDot`, `AgentProgress`, `Nav`.

### Mobile Layout

Responsive utility classes are defined in `src/app/globals.css` under a `@media (max-width: 768px)` block:

| Class | Desktop | Mobile |
|---|---|---|
| `.sd-grid-3` | `repeat(3, 1fr)` | `1fr` (stacked) |
| `.sd-grid-2` | `repeat(2, 1fr)` | `1fr` (stacked) |
| `.sd-grid-5` | `repeat(5, 1fr)` | `repeat(2, 1fr)` |
| `.sd-nav-links` | `display: flex` | `display: none` |
| `.sd-bottom-nav` | `display: none` | `display: flex` |
| `.sd-pad-x` | `padding: 0 40px` | `padding: 0 16px` |
| `.sd-inner-pad` | `padding: 48px 40px` | `padding: 24px 16px` |

**Bottom tab bar** (`sd-bottom-nav`): fixed at bottom on mobile, 5 tabs (Home, Build, Library, History, Account). Labels are 10px mono text.

**Nav avatar** is always visible on mobile even though desktop nav links are hidden — the avatar contains the user dropdown for sign-out and account access.

---

## Application Structure

### Pages (Next.js App Router)

| Route | Component | Auth Required | Description |
|---|---|---|---|
| `/` | `LandingPage` + `App.tsx` | No | Marketing landing page; logged-in users see Dashboard |
| `page=dashboard` | `Dashboard` | Yes | Home after login — stats, recent sets, wishlist preview |
| `page=builder` | `SetlistBuilder` | No (demo mode) | 3-step set configuration wizard |
| `page=output` | `SetlistOutput` | No (demo mode) | Generated setlist with track cards and export actions |
| `page=library` | `Library` | Yes | Library management — upload, wishlist, enrichment |
| `page=history` | `SetlistHistory` | Yes | Browse and reload past generated sets |
| `/set/[slug]` | Next.js page | No | Public share page for a setlist (SSR) |
| `/login` | Next.js page | No | Google OAuth sign-in |
| `/invoice` | Next.js page | No | DJ invoice generator |
| `/account` | `Account` (server+client) | Yes | Plan display, usage bar, upgrade/portal/sign-out |

Routing is handled in `App.tsx` — `navigate()` gates protected pages behind auth. SetlistBuilder and SetlistOutput are accessible without auth (demo mode — see below).

---

## Demo Mode

**SetlistBuilder and SetlistOutput work without login.** Unauthenticated users can:
- Configure a set with the full 3-step wizard
- Generate a setlist (using a hardcoded demo library of ~20 tracks)
- View the output with all track cards, energy arc, and harmonic notes

What they **cannot** do without an account:
- Save the set to history
- Export Serato crate / Rekordbox XML (requires file paths from an actual library)
- Share the set publicly
- Use their own imported library

In SetlistOutput, when a setlist exists in sessionStorage but no `dbSlug` (no saved set), the Share panel shows a "Sign In to Save" CTA instead of the share controls.

---

## Rate Limiting

Rate limiting is enforced in `/api/generate-setlist/route.ts` before the pipeline runs.

| Tier | Limit | Window |
|---|---|---|
| `free` | 5 sets | rolling 30 days |
| `pro` | 50 sets | rolling 30 days |

**Beta tester bypass:** If the user's email is in the `BETA_EMAILS` env var (comma-separated), rate limiting is skipped entirely. This is for early testers and friends who need to test beyond the free limit.

```
BETA_EMAILS=friend1@gmail.com,friend2@gmail.com,tester@example.com
```

When rate limit is hit, the API returns HTTP 429 **as plain JSON** (before the SSE stream opens):
```json
{ "error": "rate_limit", "tier": "free", "limit": 5 }
```

The client (`SetlistBuilder`) detects this and shows a full-screen upgrade card with a "Upgrade to Pro" button instead of the generation loading screen.

**Alternative for giving friends access immediately:** Run this SQL in Supabase:
```sql
UPDATE users SET subscription_tier = 'pro' WHERE email IN ('friend@gmail.com');
```

---

## Library Management (`src/components/setdrop/Library.tsx`)

### Import Modes

**Serato DB** (blue card)
- User drags in their `database V2` file
- Parsed by `/api/library/parse-db` (server-side binary parser)
- Stores tracks in `serato_libraries` + `serato_tracks` Supabase tables

**Rekordbox XML** (monochrome card)
- User drags in XML exported from Rekordbox
- Parsed client-side by `src/lib/setdrop/rekordbox-parser.ts`
- Same Supabase destination — stored as `serato_tracks` with `enrichment_source = 'rekordbox'`

### Tabs

**Library tab** — all imported tracks. Columns: #, Artist/Title (with Last.fm tags on hover), BPM, Key, Energy, Added date. Searchable + BPM range filter.

**Wishlist tab** — tracks the DJ wants to buy. Columns: #, Artist/Title, BPM, Key, Energy, Store confidence badges, Status. Manual add form with Artist, Title, BPM (optional), Key (optional), Genre (optional).

### Enrichment (fires automatically after import/add)

**Last.fm tags** (`/api/library/enrich-lastfm`)
- Fetches top tags (genre, mood, energy) for every track missing `lastfm_tags`

**BPM & Key enrichment** (`/api/library/enrich-bpm-key`)
- Uses Claude to look up BPM and Camelot key for wishlist tracks missing them
- Batches 10 tracks per Claude call

### Genre-Aware Store Ordering

Store badges on `TrackRow` (in `shared.tsx`) are rendered in genre-aware order via `orderedStores(genre?)` in `src/lib/setdrop/constants.ts`:

```ts
const ELECTRONIC_GENRES = new Set(['house','techno','drum & bass','dnb','trance','edm','electronic','dance','garage','uk garage','dubstep','ambient']);
const URBAN_GENRES = new Set(['hip hop','r&b','afrobeats','afrobeat','dancehall','latin','reggaeton','trap','grime']);

export function orderedStores(genre?: string): (keyof TrackStores)[] {
  const g = (genre ?? '').toLowerCase();
  if (ELECTRONIC_GENRES.has(g)) return ['beatport','traxsource','bpmSupreme','djcity','spotify'];
  if (URBAN_GENRES.has(g))      return ['djcity','bpmSupreme','traxsource','beatport','spotify'];
  return ['beatport','bpmSupreme','traxsource','djcity','spotify'];
}
```

`SampleTrack` in constants.ts now includes `genre?: string`. `toDisplayTrack()` in both Library.tsx and SetlistOutput.tsx passes `genre` through so the ordering reflects the actual track genre.

### Store URLs (4 Record Pools)

Every wishlist track gets search URLs for all 4 stores:

| Store | Column | URL Pattern |
|---|---|---|
| Beatport | `beatport_search_url` | `https://www.beatport.com/search/tracks?q=artist+title` (initial) → real URL after resolve |
| BPM Supreme | `bpm_supreme_search_url` | `https://www.bpmsupreme.com/search?q=artist+title` |
| Traxsource | `traxsource_search_url` | `https://www.traxsource.com/search?term=artist+title` |
| DJcity | `djcity_search_url` | `https://www.djcity.com/search?q=artist+title` |

`TrackStores` type in `shared.tsx` has confidence status for: `beatport`, `bpmSupreme`, `traxsource`, `spotify`, `djcity`.

### Real Beatport URL Resolution

After a setlist is generated and displayed in SetlistOutput, a background call to `/api/setlist/resolve-urls` runs. This **server-side proxies Beatport's unofficial search API** to find the real product page URL for each track.

```
GET https://www.beatport.com/api/v4/catalog/search?q=artist+title&type=tracks&per_page=5
```

Scoring: artist name match = 2 pts (required), title match = 1 pt. Threshold ≥ 2 to trust result. Returns `https://www.beatport.com${track.url}`. If found, the Beatport badge turns green with the real link. If not resolved, the search URL fallback stays.

---

## Setlist Builder (`src/components/setdrop/SetlistBuilder.tsx`)

3-step wizard:

### Step 1 — Gig Context
Mix Name, Venue Name, Primary Genre (required), Secondary Genre, Vibe/Mood, Crowd Context (required), Set Duration (required: 30/60/90/120 min), Lineup Slot (required).

### Step 2 — Energy Arc
Interactive SVG drag editor with 5 control points (Intro, Buildup, Peak, Sustain, Cooldown), each draggable 0–10. Three presets: Slow Burn, Peak Hour, Warm Down. Touch-enabled.

### Step 3 — Seeds (all optional)
Seed Track (autocomplete against user's library), SoundCloud URL, Wordplay Theme.

### Regenerate with Context (Rebuild)

After viewing a generated setlist, the **Rebuild** button in SetlistOutput restores all original wizard inputs in the builder. This uses `sessionStorage`:

1. SetlistOutput writes the saved context to `sd_builder_prefill` before navigating to `page=builder`:
```ts
sessionStorage.setItem('sd_builder_prefill', JSON.stringify(setlist.input));
```

2. SetlistBuilder reads and clears it on mount via `useEffect`:
```ts
const raw = sessionStorage.getItem('sd_builder_prefill');
if (!raw) return;
sessionStorage.removeItem('sd_builder_prefill');
const p = JSON.parse(raw);
// restores all fields with type guards
```

`GeneratedSetlist.input` in `src/lib/agents/types.ts` now captures the full wizard context (not just 5 fields):

```ts
input?: {
  primaryGenre: string; secondaryGenre?: string; crowdContext: string;
  durationMinutes: number; lineupSlot: string;
  mixName?: string; vibe?: string; venueName?: string;
  arcPoints?: number[]; seedSearch?: string;
  soundcloudUrl?: string; wordplay?: string;
};
```

The `setlists` table does not store these extra fields — `input` is only carried through the in-session `GeneratedSetlist` object (stored in sessionStorage/state).

### Generation Loading Screen (SSE Streaming)

The generation screen shows **real-time progress** driven by Server-Sent Events from the API. The progress steps reflect actual pipeline checkpoints — not a fake timer:

| Step | Message | When fired |
|---|---|---|
| 0 | Preparing... | Before pipeline starts |
| 1 | Analyzing your library & gig context... | Before LLM call 1 (Blueprint) |
| 2 | Building set structure... | After LLM call 1, before LLM call 2 |
| 3 | Selecting & sequencing tracks... | Before LLM call 2 (Selector) |
| 4 | Reviewing transitions... | After LLM call 2 |

The client reads the SSE stream with `res.body.getReader()`, parses `data: {...}\n\n` chunks, and updates the progress bar in real time. On a `complete` event, the setlist is extracted and the UI transitions to SetlistOutput. Progress bar transition is `4s ease` to match real timing.

---

## AI Pipeline (`src/lib/agents/pipeline.ts`)

The pipeline uses **2 LLM calls** and **1 code-computed step**. Model: `claude-sonnet-4-6`.

### Progress Callback
`runSetlistPipeline` accepts an optional `onProgress?: (event: PipelineProgressEvent) => void` callback. The API route wires this up to write SSE step events to the stream.

```ts
type PipelineProgressEvent = { type: 'step'; step: number; message: string }
```

### Step 0 — Library Profile (pure code, no LLM)
`computeLibraryProfile(tracks)` computes stats: genre distribution, BPM range, energy spread, top 5 artists, key distribution, library strengths/gaps. Avoids sending thousands of tracks to the LLM.

### Step 1 — Gig Blueprint (LLM call 1)
**Input:** Library profile + gig context  
**Output:** `{ gigIntel, blueprint }` — crowd profile, recommended BPM range, phase array with energy targets

### Step 1.5 — Track Filtering (pure code)
`filterTracksForGig()` scores and keeps top 200 tracks. Seed and wishlist tracks always pinned.

### Step 2 — Selector + Reviewer (LLM call 2)
**Input:** Blueprint, gig intel, filtered tracks (~200), recently played list  
**Output:** `{ tracks[], reviewNotes }`

Rules: harmonic mixing (Camelot wheel), genre-specific BPM transition limits, no same artist within 3 tracks, seed tracks guaranteed, do-not-repeat logic from last 90 days.

Each track includes: `position`, `artist`, `title`, `bpm`, `key`, `energyLevel`, `whyThisTrack`, `transitionNotes`, `harmonicMixingNotes`, `wordplayConnection`, `isWishlistTrack`.

---

## Setlist Output (`src/components/setdrop/SetlistOutput.tsx`)

Displays the generated set with track cards showing all AI-generated notes and store links.

### Real-Time URL Resolution
After load, fires `POST /api/setlist/resolve-urls` with the track list. While resolving, the tracklist header shows "↻ Resolving links..." spinner. On completion, Beatport badges for resolved tracks turn green with real purchase URLs.

### Setlist Renaming

The setlist name is inline-editable in two places:

**SetlistOutput.tsx:** The h1 title becomes an `<input>` when clicked. Saving (Enter or blur) calls `handleRename()` which updates local state, writes the name back to `sessionStorage`, and if the setlist is saved (`dbId` exists) also writes to Supabase:
```ts
await supabase.from('setlists').update({ name: newName }).eq('id', dbId);
```

**SetlistHistory.tsx:** Each row's name is a `<span style={{cursor:'text'}}>`. Clicking it switches to an inline `<input autoFocus>`. Enter/blur saves (optimistic local update + Supabase write), Escape cancels. State: `renamingId: string | null`, `renameValue: string`.

### Actions
- **Export Serato Crate** — `.crate` binary file for Serato DJ Pro
- **Export Rekordbox XML** — `DJ_PLAYLISTS` XML for Rekordbox
- **Share Set** — makes setlist public, copies share URL
- **Log as Played** — saves to `gig_history`
- **Rebuild** — restores all original wizard inputs (via `sd_builder_prefill` in sessionStorage) and navigates to the builder

### Demo Mode Behavior
When `dbSlug` is null (set not saved — unauthenticated user), the Share panel shows "Sign In to Save" CTA instead of share controls.

---

## Account Page (`/account` — `src/app/account/page.tsx` + `src/components/setdrop/Account.tsx`)

Server component fetches in parallel: user row (subscription_tier, stripe_customer_id), sets count for last 30 days, searchParams. Passes as props to `<Account />` client component.

### Features
- **Plan badge** — "Free Plan" or "Pro Plan" with appropriate color
- **Usage bar** — sets used / limit for rolling 30-day window. Green → yellow at 80% → red at 100%
- **Upgrade to Pro button** (free users) → `POST /api/checkout` → `window.location.href = url` (Stripe Checkout). Shows inline error message if the API returns an error (e.g. key not configured)
- **Manage Billing button** (pro users with stripe_customer_id) → `POST /api/billing-portal` → Stripe Customer Portal
- **Sign Out button** → `supabase.auth.signOut()`
- **Success banner** — appears when `?upgraded=1` in URL (after successful Stripe checkout)
- **Danger Zone** — "Delete Account" button with a confirmation panel (asks twice before deleting). Calls `POST /api/account/delete` then clears localStorage and redirects to `/`. Error state resets without crashing.
- Loading states: `'upgrade' | 'billing' | 'signout' | null`
- Stripe error state: `stripeError: string | null` — rendered below the Upgrade button in red if checkout returns an error

Nav avatar dropdown in `shared.tsx` includes an "Account" link above "Invoice Generator".

---

## Stripe Integration

### Stripe Setup in Code

`src/lib/stripe.ts` — lazy singleton pattern (avoids build-time throw):

```ts
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' });
  }
  return _stripe;
}
export const PLANS = {
  pro: { name: 'SetDrop Pro', priceId: process.env.STRIPE_PRO_PRICE_ID ?? '', limit: 50 },
  free: { name: 'SetDrop Free', limit: 5 },
} as const;
```

**Critical:** Never instantiate `new Stripe(...)` at module level — it runs at Vercel build time when env vars aren't available and will crash the build.

### API Routes

**`POST /api/checkout`** — creates a Stripe Checkout Session
- Reuses existing `stripe_customer_id` or creates a new Stripe Customer
- Returns `{ url }` for client to redirect to
- Success URL: `/account?upgraded=1`, cancel URL: `/account`
- **Always returns JSON** (errors wrapped in try/catch with `NextResponse.json({ error: message }, { status: 500 })`) — never an empty body
- Client reads response with `res.text()` then `JSON.parse(text)` to handle any potential empty response gracefully

**`POST /api/billing-portal`** — creates a Stripe Customer Portal session
- Requires existing `stripe_customer_id`
- Returns `{ url }` for client to redirect to

**`POST /api/webhooks/stripe`** — handles Stripe events
- Verifies signature: `stripe.webhooks.constructEvent(body, sig, secret)`
- `checkout.session.completed` → sets `subscription_tier = 'pro'`, saves `stripe_subscription_id`
- `customer.subscription.deleted` → reverts `subscription_tier = 'free'`
- `customer.subscription.updated` → sets tier based on `subscription.status` (`active`/`trialing` = pro)

### Stripe Dashboard Setup (Required)
1. Create a **Product** called "SetDrop Pro" in the Stripe Dashboard
2. Add a **recurring price** (e.g. $9.99/month) to that product
3. Copy the **Price ID** (format: `price_1ABC...`) → set as `STRIPE_PRO_PRICE_ID` env var
4. Register a **webhook endpoint** at `https://your-domain.com/api/webhooks/stripe` listening for:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Copy the **Webhook Signing Secret** → set as `STRIPE_WEBHOOK_SECRET` env var
6. **Activate the Customer Portal** in Stripe Dashboard → Settings → Billing → Customer Portal

### Stripe Type Notes (v22.1.0, API version `2026-04-22.dahlia`)
- Correct: `Stripe.Checkout.Session` (not `Stripe.CheckoutSession`)
- Correct: `Stripe.Subscription`
- The `apiVersion` string must be `'2026-04-22.dahlia'` — older version strings won't typecheck

---

## Supabase Schema

| Table | Key Columns | Purpose |
|---|---|---|
| `users` | `id`, `email`, `subscription_tier` ('free'/'pro'), `stripe_customer_id`, `stripe_subscription_id` | Auth user mirror + billing state |
| `serato_libraries` | `id`, `user_id`, `total_tracks`, `last_synced` | One row per user's library |
| `serato_tracks` | `id`, `library_id`, `artist`, `title`, `bpm`, `key`, `genre`, `file_path`, `lastfm_tags`, `enrichment_source` | Individual library tracks |
| `wishlist_tracks` | `id`, `user_id`, `artist`, `title`, `bpm`, `key`, `genre`, `status`, `lastfm_tags`, `beatport_search_url`, `bpm_supreme_search_url`, `traxsource_search_url`, `djcity_search_url`, `added_at` | Tracks to buy — 4 store URLs |
| `setlists` | `id`, `user_id`, `name`, `primary_genre`, `secondary_genre`, `crowd_context`, `duration_minutes`, `lineup_slot`, `energy_arc`, `is_public`, `share_url`, `tracks_json`, `created_at` | Generated sets |
| `gig_history` | `id`, `user_id`, `gig_name`, `gig_date`, `venue`, `setlist_id`, `played_at` | Played gig log |

### users table additions (new columns, need migration if not present):
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
```

### wishlist_tracks addition:
```sql
ALTER TABLE wishlist_tracks ADD COLUMN IF NOT EXISTS djcity_search_url text;
```

---

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/generate-setlist` | POST | Optional | SSE stream — rate limit check, runs AI pipeline, emits step events + complete event |
| `/api/setlist/resolve-urls` | POST | No | Server-side proxy to Beatport search API, returns real track page URLs |
| `/api/checkout` | POST | Yes | Create Stripe Checkout Session, return URL |
| `/api/billing-portal` | POST | Yes | Create Stripe Customer Portal session, return URL |
| `/api/webhooks/stripe` | POST | — | Handle Stripe webhook events, update subscription_tier |
| `/api/library/parse-db` | POST | Yes | Parse Serato `database V2` binary, save to Supabase |
| `/api/library/enrich-lastfm` | POST | Yes | Fetch Last.fm tags for all tracks missing them |
| `/api/library/enrich-bpm-key` | POST | Yes | Use Claude to look up BPM/key for wishlist tracks |
| `/api/auth/callback` | GET | — | Supabase OAuth callback handler |
| `/api/account/delete` | POST | Yes | Hard-delete all user data |
| `/api/invoice/generate` | POST | No | Generate PDF invoice |
| `/api/invoice/send` | POST | No | Email invoice PDF |
| `/api/spotify/auth` | GET | Yes | Start Spotify OAuth flow |
| `/api/spotify/callback` | GET | — | Spotify OAuth callback |
| `/api/spotify/status` | GET | Yes | Check if Spotify is connected |
| `/api/spotify/playlists` | GET | Yes | List user's Spotify playlists |
| `/api/spotify/import` | POST | Yes | Import Spotify playlist as wishlist tracks |
| `/api/spotify/disconnect` | POST | Yes | Remove Spotify token |

All serverless functions use `export const maxDuration = 300` (Vercel 300s timeout, App Router syntax). **Do NOT use `export const config = { api: { ... } }` — that is Pages Router syntax and will cause Vercel build failures in App Router.**

---

## Export Formats

### Serato .crate (`src/lib/setdrop/serato-crate.ts`)
Binary TLV format with UTF-16 BE strings. Only works for tracks with a `file_path` stored at import time.

### Rekordbox XML (`src/lib/setdrop/rekordbox-export.ts`)
`DJ_PLAYLISTS` XML format. `<COLLECTION>` with track metadata + `<PLAYLISTS>` with named playlist. File paths converted to `file://` URIs.

---

## Public Share Page (`/set/[slug]`)

Server-rendered (SSR). Reads from `setlists` where `is_public = true` and `share_url = slug`. Shows set metadata, energy arc SVG, full tracklist, CTA to build your own set. Open Graph metadata for social sharing.

---

## Key Implementation Notes

**SSE instead of polling:** The generation API returns a `ReadableStream` (Server-Sent Events) instead of a JSON blob. This is the right choice because the two LLM calls take 15–40s each with no intermediate output — a fake progress timer felt dishonest and a long JSON await gives no feedback. SSE lets the client show real checkpoints aligned with what the server is actually doing.

**JSON repair:** `jsonrepair` is applied to all Claude responses before `JSON.parse`. Recovers from truncated/slightly malformed JSON which occasionally happens with large token outputs.

**Large library handling:** (1) Statistical library profile computed in code instead of sending raw tracks to LLM call 1. (2) Top 200 tracks filtered by genre/BPM scoring before LLM call 2. (3) Seed and wishlist tracks always pinned through filtering.

**Beatport URL proxy:** Beatport's unofficial search API is called server-side because browsers block direct cross-origin requests to it. The 7s timeout per track and `Promise.allSettled` ensure one slow/failed track doesn't block the others.

**Stripe lazy init:** `new Stripe()` must be inside a function, never at module level. Next.js analyzes module-level code during build — env vars aren't available then, so a module-level throw crashes the Vercel build.

**LocalStorage cache:** After library upload, `sd_library` is written to localStorage for display and seed autocomplete. The generation pipeline always reads from Supabase.

**ClickUp extension conflict:** The ClickUp browser extension intercepts `fetch()` calls and causes "Failed to fetch" errors. Disable for the app's domain.

**Middleware:** Uses `src/proxy.ts` as middleware (non-standard Next.js pattern for this version).

---

## Environment Variables

| Variable | Used In | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Server | Claude API — required for generation and BPM/key enrichment |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role for server-side writes |
| `LASTFM_API_KEY` | Server | Last.fm API key for tag enrichment |
| `STRIPE_SECRET_KEY` | Server | Stripe secret key — get from Stripe Dashboard → Developers → API Keys. Must start with `sk_test_` (test mode) or `sk_live_` (live). Keys starting with `mk_` or anything else are invalid and will throw "Invalid API Key" at runtime. |
| `STRIPE_WEBHOOK_SECRET` | Server | Stripe webhook signing secret — get from webhook endpoint config in Stripe Dashboard |
| `STRIPE_PRO_PRICE_ID` | Server | Stripe Price ID for the Pro plan (format: `price_1ABC...`) |
| `BETA_EMAILS` | Server | Comma-separated emails that bypass rate limiting (e.g. `friend@gmail.com,tester@test.com`) |
| `NEXT_PUBLIC_APP_URL` | Client | Public URL for share links and Stripe redirect URLs |
| `SPOTIFY_CLIENT_ID` | Server | Spotify OAuth client ID |
| `SPOTIFY_CLIENT_SECRET` | Server | Spotify OAuth client secret |

---

## Known Limitations / Pending Work

- **Stripe Customer Portal must be activated** in Stripe Dashboard → Settings → Billing → Customer Portal before the billing portal button will work.
- **Arc points not persisted to DB** — `arcPoints` in `GeneratedSetlist.input` lives only in sessionStorage / in-session state; the `setlists` table doesn't store the full input context, only the high-level fields (`primary_genre`, `crowd_context`, etc.). Rebuild restores from the in-session object, not from history rows.
- **Setlist share page** — the public `/set/[slug]` page shows the stored tracklist but not the energy arc (arc SVG requires the `arcPoints` array, which isn't stored in the DB `tracks_json`).

---

## Addressing Suggestions from Claude Chat

This section rebuts or clarifies common AI assistant suggestions that don't apply to this specific codebase.

### "Use polling instead of SSE for generation progress"
SSE is correct here. The two LLM calls each take 15–40 seconds. Polling would require storing intermediate state server-side (where? Supabase? Redis? Neither is wired up) and adds latency. SSE is a single open connection that the server writes to as work completes — no extra infrastructure, no state management overhead. The `TransformStream` + `ReadableStream` approach works natively in Next.js App Router with no additional packages.

### "Add a database/Redis cache for rate limiting instead of querying Supabase"
Unnecessary at this scale. The rate limit check is a single Supabase count query against `setlists` filtered by `user_id` and `created_at > now() - interval '30 days'`. This adds ~50ms and is not a hot path (runs once per generation, not per request). Adding Redis would introduce another external service for zero practical benefit.

### "Use webhooks + database state for Stripe instead of client-side redirects"
The implementation already does this correctly. The Stripe webhook handles the authoritative state update (subscription_tier in Supabase). The `?upgraded=1` URL param is just a UI signal to show the success banner — it has no bearing on whether the user is actually pro. The webhook is the source of truth.

### "Use `export const config = { api: { bodyParser: false } }` in the webhook route to disable body parsing"
This is **Pages Router syntax**. In App Router (`src/app/`), `req.text()` reads the raw body natively without any configuration. Using the old `export const config` pattern in App Router causes Vercel build warnings that are treated as errors. Do not add it.

### "Generate search URLs client-side and open tabs directly"
We proxy Beatport's unofficial search API server-side via `/api/setlist/resolve-urls` because browsers block cross-origin requests to `beatport.com`. The search URL pattern fallback (`/search/tracks?q=...`) is only used as a last resort when the real URL can't be resolved. Client-side direct API calls to third-party endpoints will fail with CORS errors.

### "Add Tailwind CSS for styling"
The entire codebase uses inline styles with the `SD` design token object. Migrating to Tailwind would require touching every component and provides no functional benefit. The current approach is consistent and the design tokens centralize all values. Don't suggest Tailwind.

### "Split the `generate-setlist` route into separate endpoints for each pipeline step"
The pipeline is intentionally one SSE stream. Splitting into separate HTTP calls would require the client to manage state between calls, handle partial failures, and make the code significantly more complex. The SSE approach keeps all state server-side for the duration of the request and requires only one client-side fetch.
