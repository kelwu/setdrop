# SetDrop — Session Context

*Drop this file into any Claude conversation to continue building SetDrop without re-explaining the project.*

---

## What It Is

A personal DJ project (the builder's hobby) using Claude Code + AI to handle the **grunt work** around DJing. **Not** trying to replace creative work — the DJ stays the creative force; SetDrop handles track ID, library data, gig context, and post-gig analysis.

**Strategic position:** Own the complete pre-gig system end-to-end. Track ID → wishlist → library intelligence → gig-context AI generation (as a starting point the DJ tweaks) → multi-format export → post-gig reflection feeding next pre-gig. Live mode is **parked** (PulseDJ already owns that axis for free).

---

## Live Infrastructure

- **Vercel:** https://setdrop-phi.vercel.app
- **GitHub:** https://github.com/kelwu/setdrop (auto-deploys `main`)
- **Supabase:** project `ukyebaaosqzdesbxsrzk` (us-east-1)
- **Local dev:** `C:\Users\wuazn\Desktop\Product by Kel\Projects\setdrop` — runs on `localhost:3001`
- **Stack:** Next.js 16, React 19, Supabase, Vercel, Anthropic `claude-sonnet-4-6`, ACRCloud

---

## Pricing

- Free: 5 sets/mo, 10 Track IDs/mo
- Pro: $12/mo — 50 sets/mo, 500 Track IDs/mo ("unlimited" marketing)
- Billing: Stripe checkout + webhook + billing portal

---

## Shipped Features

**Core pipeline**
- AI setlist generation (`/api/generate-setlist`) — streaming SSE, 2-call pipeline: `runGigBlueprint` (web search venue/trend intel) → `runSelectorReviewer`. **Do NOT refactor.**
- Rate limit by tier; beta email bypass

**Library / import**
- Serato DB V2 binary parse (`/api/library/parse-db`)
- Rekordbox XML parse (client-side)
- Library save/sync with insert-first diff (`/api/library/save`)
- Spotify OAuth + playlist → wishlist import
- Last.fm tag enrichment
- BPM/key enrichment via Claude, capped at 50 rows

**Export**
- Serato `.crate` binary (`src/lib/setdrop/serato-crate.ts`)
- Rekordbox XML + M3U (`src/lib/setdrop/rekordbox-export.ts`)

**Dashboard intelligence**
- Library Intelligence: percentile BPM gap detection + AI track recommendations
- Trending by Genre: two-phase forced web search, 24h cache, `maxDuration=120`
- Dashboard redesign: compact status strip (28px display), Next Gig countdown widget, tabbed Discover (Trending | Library Gaps)

**Track ID v1**
- Mic recording (tap-to-stop 5–15s) + file upload
- ACRCloud audio fingerprinting (`src/lib/setdrop/acrcloud.ts`)
- Library/wishlist dedup badges
- Quota: 10 free / 500 pro per month
- Entry points: desktop nav, mobile bottom nav (◎), Dashboard "ID a Track" button
- Env vars required: `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_ACCESS_SECRET`, `ACRCLOUD_HOST`

**Community + auth**
- Public set sharing (`/set/[slug]`) with energy arc SVG + OG metadata
- Explore feed with likes; unique constraint on `(user_id, setlist_id)`
- Email/password + Google OAuth
- Account deletion: auth user deleted first, data cleanup best-effort
- Stripe webhook uses `createAdminClient()` (critical RLS fix)

---

## Hard Constraints (from CLAUDE.md)

- Serato `database V2` is **read-only** — never write to it
- Only write new `.crate` files to `Subcrates/` subfolder
- `setlists.tracks_json` is source of truth — not `setlist_tracks` junction table
- Never read/modify/write MP3 audio files — metadata only
- Invoice generation only — no payment processing
- Community features: opt-in public sharing only, private by default
- Pipeline core (`computeLibraryProfile` → `runSelectorReviewer`) — do NOT refactor

---

## The Co-Pilot Principle (informs every feature decision)

| AI is good at (ship) | AI shouldn't own (reframe/kill) |
|---|---|
| Track identification | "Pick your closing track" |
| BPM/key detection | "Generate your perfect set" |
| Library gap analysis (data) | Live in-set suggestions |
| Tracklist annotation post-gig | "Plan your set in 30 seconds" framing |
| Surfacing options (you choose) | Making the choice for you |

DJ community pushback against AI replacing creative work is real and valid. Build-in-public video is a **developer story** (using Claude Code), not a vendor pitch (selling to DJs).

---

## Active Build Plan (5 phases, 7-9 weeks)

1. **Weeks 1-3: Design System Unification** — `PageHeader`, shared `Card`, `Tabs`, `Badge`, `EmptyState`, `LoadingState` primitives. Mobile pass. Color semantics. Publish→Explore feedback loop. Wordplay→Builder integration.
2. **Week 4: Track ID v2** — paste SoundCloud/Mixcloud URL → full timestamped tracklist via ACRCloud DJ Mix Recognition. Bulk wishlist add.
3. **Weeks 5-6: Library Intelligence v2 + Themed Crates** — sub-genre awareness, emerging artists web search, energy gaps. Themed crate generation (`/api/crates/generate`) — "warmup", "wedding cocktail", etc.
4. **Week 7: Post-Gig Reflection** — upload recording, planned vs actual energy arc, track-level diff, pattern surfacing. **Pure data, no prescription.**
5. **Week 8: Build-in-Public Capture + Script** — parallel with Phase 4.

Plan file: `C:\Users\wuazn\.claude\plans\compressed-dreaming-cocke.md`

---

## Competitive Landscape (informs cuts)

- **PulseDJ** (free) — multi-DAW live co-pilot. Don't compete.
- **MusicMate** (50k+ DJs) — generic AI set planning. Don't compete.
- **Djoid** (€99/yr) — visual library graph. Don't compete.
- **Moises AI** — stem separation + practice setlists, adjacent.
- **VirtualDJ 2026** — DAWs absorbing AI features, long-term threat.

SetDrop's unique angle: **the complete pre-gig system end-to-end** + gig context awareness + Track ID → wishlist → set loop.

---

## Recent Commits

```
03eefc5 feat(design-system): Phase 1.1 — extend SD with spacing, type, semantic-color, and radius scales
435ea70 docs: update setdrop-context.md with strategic pivot — pre-gig system focus, live mode parked, co-pilot principle
f9c3c23 chore: add nightly context updater GitHub Action + initial setdrop-context.md
69302df feat: give Track ID a proper home — nav link, mobile nav, dashboard CTA
afe0f15 fix: add AbortController timeout to trending fetch — graceful error on slow dev server
f2f423b fix: restore visual weight in status strip — 28px display numbers
2c8c52f feat: dashboard UI refresh — status strip, next gig widget, tabbed discover
c2395f7 chore: remove debug logging from acrcloud
af25333 debug: add ACRCloud URL and response logging
d85baad fix: strip protocol from ACRCLOUD_HOST, bump trending-charts timeout
80f5a44 feat: Track ID — identify tracks via microphone or file upload
e54829e fix: low-severity issues from final review
aa123c0 fix: library save atomicity, enrichment credit cap, Spotify batch insert
fc760aa fix: critical billing bug, account delete safety, and UX improvements
43f1337 fix: surface actual error message from trending-charts 500 response
f1d9d0e fix: remove web_search from analyze-gaps to eliminate 504 timeout
630bca2 fix: 504 timeout and JSON parse crash on trending-charts and analyze-gaps
2da3dd3 docs: add YouTube episode build brief with full feature breakdown and stack diagram
bdc64ef feat: Trending by Genre dashboard card with genre-aware chart sources
4e79aab fix: use claude-sonnet-4-6 for analyze-gaps — haiku does not support web_search + custom tools together
```

---

*Last updated: 2026-06-06*
