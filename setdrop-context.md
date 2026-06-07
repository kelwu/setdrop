# SetDrop — Session Context

*Drop this file into any Claude conversation to continue building SetDrop without re-explaining the project.*

> **⚠️ NAMING IN PROGRESS:** "SetDrop.app" was already taken. "CrateIQ" also has a conflict (crateiq.app is an active pre-launch AI vinyl pricing tool targeting DJs). Still deciding. All user-visible strings now route through `src/lib/brand.ts` — a rename is one file + the external checklist documented in that file.

---

## What It Is

A personal DJ hobby project (the builder's own) using Claude Code + AI to handle the **grunt work** around DJing. **Not** trying to replace creative work — the DJ stays the creative force. This is a developer story for a build-in-public YouTube video.

**Strategic position:** Own the complete pre-gig system end-to-end. Track ID → wishlist → library intelligence → gig-context AI generation (as a *starting point* the DJ tweaks) → multi-format export → post-gig reflection. **Live in-set companion deliberately parked** — PulseDJ (free) and Banger Button ($99-$200/yr) both already do that. The pre-gig moat is wider and uncontested.

---

## Live Infrastructure

- **Vercel:** https://setdrop-phi.vercel.app
- **GitHub:** https://github.com/kelwu/setdrop (auto-deploys `main`)
- **Supabase:** project `ukyebaaosqzdesbxsrzk` (us-east-1)
- **Local:** `C:\Users\wuazn\Desktop\Product by Kel\Projects\setdrop` (dev on `localhost:3001`)
- **Stack:** Next.js 16, React 19, Supabase, Vercel, Anthropic `claude-sonnet-4-6`, ACRCloud
- **Pricing:** Free 5 sets/mo + 10 Track IDs/mo · Pro $12/mo, 50 sets + 500 Track IDs

---

## Everything Shipped

**Core pipeline** — AI setlist generation (`/api/generate-setlist`), streaming SSE, 2-call: `runGigBlueprint` (web search) → `runSelectorReviewer`. **Do NOT refactor.**

**Library / import** — Serato DB V2 (`/api/library/parse-db`), Rekordbox XML (client), insert-first diff save, Spotify OAuth → wishlist, Last.fm tags, Claude BPM/key enrichment (50-row cap).

**Export** — Serato `.crate` (`src/lib/setdrop/serato-crate.ts`), Rekordbox XML + M3U, public share pages (`/set/[slug]`) edge-cached.

**Dashboard** — Library Intelligence (BPM gap detection + AI recs), Trending by Genre (two-phase forced web search, 24h cache), redesigned status strip (28px display nums), Next Gig countdown widget, tabbed Discover (Trending | Library Gaps).

**Track ID v1** — Mic (tap-to-stop 5–15s) + file upload, ACRCloud fingerprinting, library/wishlist dedup badges. Env: `ACRCLOUD_ACCESS_KEY` / `ACRCLOUD_ACCESS_SECRET` / `ACRCLOUD_HOST`.

**Track ID v2 — Mix Tracklist** ← *just shipped* — New "Mix Tracklist" tab on `/id`. User uploads a DJ mix (up to 200MB). Browser decodes via Web Audio API, slices 10s samples every 45s, sends each to existing `/api/track-id`, deduplicates consecutive same-track matches. Returns a timestamped tracklist + bulk "Add All to Wishlist". `src/lib/setdrop/mix-scanner.ts` contains the chunker + WAV encoder + scanner. Each chunk counts as 1 ID against monthly quota; confirm screen shows cost upfront. URL-paste mode (SoundCloud/Mixcloud) deferred — ToS concerns.

**Community + billing + auth** — Explore feed + likes, Stripe checkout/portal/webhook (admin-client), email + Google OAuth, account delete (auth-first).

**Design system (Phase 1 — complete)**
- `src/lib/setdrop/constants.ts`: SD tokens — spacing `s1–s9`, type `t10–t72`, semantic colors `success/warning/danger/info`, radius `r1–r4`
- `src/components/setdrop/shared.tsx`: `PageHeader`, `Card`, `CardHeader`, `Tabs` (with optional `count`), `Badge`, `EmptyState`, `LoadingState`
- All 7 pages refactored (Dashboard, Track ID, History, Builder, Library, Output, Explore)
- Mobile: `.sd-sticky-on-desktop` class — Output sidebar now collapses correctly below 768px
- Wordplay → Builder: "Use in Set" button writes `sessionStorage` prefill + navigates to `/builder`
- Publish → Explore: toast after Make Public with "View →" link
- Library flash fix: `libraryLoaded` boolean gates the UploadZone
- `src/lib/brand.ts`: BRAND constant — `name`, `nameAllCaps`, `logoLeft`, `logoRight`, `domain`, `tagline`. All user-visible strings route through it.

---

## Hard Constraints (CLAUDE.md)

- Serato `database V2` is **read-only** — never write
- Only write new `.crate` files to `Subcrates/`
- `setlists.tracks_json` is source of truth — not `setlist_tracks` junction
- Never read/modify/write MP3 audio — metadata only
- Invoice generation only — no payment processing
- Pipeline core (`computeLibraryProfile` → `runSelectorReviewer`) — do NOT refactor

---

## Co-Pilot Principle (non-negotiable)

AI handles grunt work: track ID, BPM/key detection, library data, mix tracklisting, tracklist annotation, multi-format export, surfacing options. **AI should NOT own:** "pick your closing track", live in-set suggestions, "generate your perfect set" framing. Existing set generation stays as a **starting point** the DJ tweaks. DJ community has a strong allergy to AI replacing creative decisions — this is the product positioning, not just a feature choice.

---

## Competitive Landscape

**Live-companion lane — PARKED. Do not build.**
- **PulseDJ** — free, works with all 5 major DAWs (Serato/Rekordbox/Traktor/VirtualDJ/djay PRO)
- **Banger Button** (bangerbutton.com) — $99/yr or $20/mo (50% promo), Serato + VirtualDJ drag-drop, Crate Hackers content partnership, Rekordbox/Traktor "coming soon". Encountered 2026-06-07.

Both targeting same DJ audience with the same real-time suggestion feature. Third entrant has no position.

**Adjacent — different lane:**
- MusicMate (50k+ DJs) — generic AI set planning from text prompts
- Djoid (€99/yr) — visual library graph/scatter map
- Moises AI — stems + practice setlists, adjacent not direct

**Pricing validation:** The DJ market pays $100-$200/yr for AI tools. SetDrop's $144/yr Pro sits at market norm. Willingness to pay is validated.

---

## Active Plan & Video Roadmap

Plan file: `C:\Users\wuazn\.claude\plans\compressed-dreaming-cocke.md`

**Decision made:** Stop building after Phase 3, start scripting. Phase 4 (post-gig reflection) becomes "what I'm building next" — better as Episode 2 content AND requires real gig footage to be authentic.

| Phase | Status | Work |
|-------|--------|------|
| 1 — Design system | ✅ Done | Tokens, primitives, page refactors, mobile, polish |
| 2 — Track ID v2 | ✅ Done | Mix Tracklist scanner shipped |
| 3 — Library Intelligence v2 + Themed Crates | 🔲 Next | Sub-genre awareness, emerging artists, `/api/crates/generate`, Crates tab in Library |
| 4 — Post-gig Reflection | 🔲 Later | Upload recording → planned vs actual arc (deferred to Ep. 2) |
| 5 — Script + Film | 🔲 After Phase 3 | |

**Video story arc (build-in-public, developer story):**
1. "I'm a DJ. I built a personal project using Claude Code."
2. "DJ community pushback: 'AI shouldn't plan your sets.' They're right."
3. "What AI IS good at: grunt work. Track ID, library data, mix tracklisting."
4. "Strategic cut: PulseDJ + Banger Button own live suggestions. I own pre-gig."
5. "Design system overhaul — before/after."
6. "Track ID v2 — paste a mix, get the tracklist." ← magic moment
7. "Themed crates on demand from your own library." ← Phase 3
8. "What building this with Claude Code taught me."

---

## Recent Commits

```
61aaf0b feat(track-id): Phase 2 MVP — Mix Tracklist scanner
07168c7 refactor(brand): extract BRAND constant for easy rename
1b2cc20 refactor(colors): Phase 1.5 — hex hardcodes → semantic tokens
e51eff9 feat(library): Phase 1.6 — Wordplay → Builder integration
0e75ca5 refactor(explore): Phase 1.3f — adopt shared primitives
2ddfc8c fix(output): mobile sidebar stacking + publish-to-Explore feedback loop
cb58164 refactor(library): swap inline TabBtn for shared Tabs
1eaf05a fix(library): eliminate 3-second flash of UploadZone
fadda3b feat(design-system): Phase 1.2 — shared primitives
03eefc5 feat(design-system): Phase 1.1 — token extension
80f5a44 feat: Track ID v1 — mic + file upload via ACRCloud
fc760aa fix: critical Stripe webhook RLS bug, account delete safety
```

---

## Pending Decisions

- **App name still TBD.** Lock this before filming. Rename is: update `src/lib/brand.ts` (5 strings) + external services checklist (domain, GitHub repo, Vercel project, Stripe, ACRCloud, Resend). All external services listed in `brand.ts` comments.
- **Phase 3 scope:** `src/lib/setdrop/constants.ts` has genres. Themed crates need `themed_crates` table (Supabase migration), `/api/crates/generate` route, and a new "Crates" tab in Library using shared `<Tabs>`.

---

*Last updated: 2026-06-07*
