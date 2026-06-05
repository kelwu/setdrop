# SetDrop — Session Context

*Drop this file into any Claude conversation to continue building SetDrop without re-explaining the project.*

---

## What It Is

AI-powered DJ setlist planning app. Input: Serato/Rekordbox library + gig context (genre, crowd, slot, duration). Output: AI-generated ordered tracklist with energy arc, transitions, and key notes. Exports to Serato `.crate`, Rekordbox XML, and M3U.

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
- Pro: $12/mo — 50 sets/mo, 500 Track IDs/mo (marketed as "unlimited")
- Billing: Stripe checkout + webhook + billing portal

---

## Everything That's Shipped

**Core pipeline**
- AI setlist generation (`/api/generate-setlist`) — streaming SSE, 2-call pipeline: `runGigBlueprint` (web search for venue/trend intel) → `runSelectorReviewer` (track selection + ordering). Do NOT refactor this.
- Rate limiting by subscription tier; beta email bypass

**Library / import**
- Serato DB V2 binary parse (`/api/library/parse-db`)
- Rekordbox XML parse (client-side)
- Library save/sync with insert-first diff (`/api/library/save`)
- Spotify OAuth + playlist → wishlist import
- Last.fm tag enrichment (`/api/library/enrich-lastfm`)
- BPM/key enrichment via Claude, capped at 50 rows (`/api/library/enrich-bpm-key`)

**Export**
- Serato `.crate` binary export (`src/lib/setdrop/serato-crate.ts`)
- Rekordbox XML export + M3U (`src/lib/setdrop/rekordbox-export.ts`)

**Dashboard intelligence**
- Library Intelligence: percentile BPM gap detection + AI recommendations (`/api/library/analyze-gaps`)
- Trending by Genre: two-phase forced web search, 24h cache (`/api/dashboard/trending-charts`)
- Dashboard redesign: compact status strip, Next Gig countdown widget, tabbed Discover card (Trending | Library Gaps), action cards moved above discovery

**Track ID** ← just shipped
- Mic recording (tap-to-stop, 5–15s) + file upload
- ACRCloud audio fingerprinting (`src/lib/setdrop/acrcloud.ts`)
- Library/wishlist dedup badges ("Already in your library!")
- Quota enforcement (10 free / 500 pro per month)
- Entry points: desktop nav "Track ID" link, mobile nav, Dashboard "ID a Track" button
- Required env vars: `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_ACCESS_SECRET`, `ACRCLOUD_HOST`

**Community / sharing**
- Public set sharing (`/set/[slug]`) with energy arc SVG + OG metadata
- Explore feed with likes (`/api/explore/sets`, `/api/explore/like`)
- `set_likes` has unique constraint on `(user_id, setlist_id)` — race-condition safe

**Auth + account**
- Email/password + Google OAuth
- Account deletion: auth user deleted first, data cleanup is best-effort after

**Billing**
- Stripe webhook uses `createAdminClient()` (critical fix — was silently blocked by RLS)

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

## What's Next (unbuilt)

1. **Track ID v2** — URL paste mode: paste a SoundCloud mix URL → ACRCloud DJ Mix Recognition → full timestamped tracklist → bulk add to wishlist. Needs legal review for server-side audio extraction.
2. **Live "what's next" companion** — mid-set assistant. During a live gig, suggest the next 3 tracks from your library based on what just played + energy direction. Phone-friendly view.
3. **Themed standalone crate generation** — "Build me a warmup crate from my library" without going through full setlist generation. Currently crate export is setlist-only.
4. **Desktop helper for crate auto-sync** — eliminate the download-then-copy step for Serato crates.
5. **Builder / Library / Explore UX pass** — only Dashboard was reviewed in depth.
6. **Mobile breakpoints verification** — globals.css has overrides but not verified page by page.

---

## Recent Commits (last session)

```
69302df feat: give Track ID a proper home — nav link, mobile nav, dashboard CTA
afe0f15 fix: AbortController timeout on trending fetch
f2f423b fix: restore visual weight in status strip — 28px display numbers
2c8c52f feat: dashboard UI refresh — status strip, next gig widget, tabbed discover
80f5a44 feat: Track ID — identify tracks via microphone or file upload
e54829e fix: low-severity issues from Opus final review
aa123c0 fix: library save atomicity, enrichment credit cap, Spotify batch insert
fc760aa fix: critical billing bug (Stripe webhook RLS), account delete safety
```

---

*Last updated: 2026-06-04*
