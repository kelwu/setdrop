# SetDrop — Session Context

*Drop this file into any Claude conversation to continue building SetDrop without re-explaining the project.*

> **✅ NAME LOCKED: SetLab** — domain `setlab.ai` purchased 2026-06-09. `src/lib/brand.ts` updated. External services still need updating — see checklist below.

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

**Track ID v2 — Mix Tracklist** — New "Mix Tracklist" tab on `/id`. User selects a DJ mix file (client-side only — browser decodes via Web Audio API, slices into 10s WAV chunks every 45s, POSTs each chunk to `/api/track-id`). The server never receives the full mix — only chunks up to 10MB each. Deduplicates consecutive same-track matches. Returns a timestamped tracklist + bulk "Add All to Wishlist". `src/lib/setdrop/mix-scanner.ts` contains the chunker + WAV encoder + scanner. Each chunk counts as 1 ID against monthly quota; confirm screen shows cost upfront.

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

**Library Intelligence v2 (Phase 3.1 — complete)**
- `src/app/api/library/analyze-gaps/route.ts` — sub-genre resolution via lastfm_tags (15 sub-genres: tech house, deep house, afro house, trap, drill, etc.), energy gap detection (per-genre BPM tiers), emerging artists via 2-phase web search (cross-referenced against library, strips already-owned artists, runs in parallel with BPM recs). `maxDuration` 120s.
- Dashboard renders energy insights as warning chips + "Rising in this genre" per gap card with Beatport search links.

**Themed Crates (Phase 3.2 + 3.3 — complete)**
- Supabase `themed_crates` table (id, user_id, name, prompt, tracks_json, created_at + RLS).
- `src/app/api/crates/generate/route.ts` — POST `{ prompt, targetCount? }`. Claude parses prompt → structured profile (genre keywords, BPM range, energy direction) → filter library → sort by energy curve → save.
- `src/app/api/crates/route.ts` — GET (list) + DELETE.
- `src/components/setdrop/Library.tsx` — new "Crates" tab (4th tab after Wordplay). Generate form (prompt + track count), active crate preview with full track table, Export .crate / Rekordbox XML / M3U buttons, saved crates list with View/Delete. Reuses existing export utilities.

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

**Pricing validation:** The DJ market pays $100-$200/yr for AI tools. SetLab's $144/yr Pro sits at market norm. Willingness to pay is validated.

---

## Build Status

| Phase | Status | Work |
|-------|--------|------|
| 1 — Design system | ✅ Done | Tokens, primitives, page refactors, mobile, polish |
| 2 — Track ID v2 | ✅ Done | Mix Tracklist scanner shipped |
| 3 — Library Intelligence v2 + Themed Crates | ✅ Done | Sub-genre awareness, emerging artists, `/api/crates/generate`, Crates tab |
| 4 — Post-gig Reflection | 🔲 Deferred | Episode 2 — requires real gig footage to be authentic |
| 5 — Script + Film | 🟡 In progress | Episode script draft exists — see below |

**Decision:** Stop building. Phase 4 (post-gig reflection) becomes "what I'm building next" — better as Episode 2 content AND requires real gig footage to be authentic.

---

## Security Audit — Complete (2026-06-08)

All issues found and fixed. Safe to go live.

**Fixed — critical (unauthenticated AI endpoints, financial DoS risk):**
- `generate-setlist` — was callable unauthenticated, skipping rate limiting entirely
- `setlist/resolve-urls` — no auth + unbounded fan-out (up to 3 Claude calls per track, no array cap). Fixed: auth guard + 100-track cap.
- `wordplay/search` — no auth. Fixed: auth guard added.

**Fixed — medium:**
- `invoice/generate` — no auth. Fixed.
- `invoice/send` — no auth. Fixed.
- `library/parse-db` — no file size cap before buffering into memory. Fixed: 50MB cap enforced before `arrayBuffer()`.

**Confirmed clean:**
- All secrets (`ANTHROPIC_API_KEY`, `ACRCLOUD_*`, `SERVICE_ROLE_KEY`, `SPOTIFY_CLIENT_SECRET`, `STRIPE_SECRET`) are server-only — never in client bundle.
- RLS enabled on all 13 Supabase tables including `themed_crates`. All policies owner-scoped.
- Stripe webhook: `constructEvent` signature verification in place.
- Track ID upload: 10MB server-side cap + 1KB floor on audio chunks.
- Supabase leaked-password protection: enabled.

**Architecture note:** Most data routes use the admin client (service role, bypasses RLS) — real access control is the in-code `getUser()` + `.eq('user_id', user.id)` filters. RLS is the backstop. Any future route that forgets the `user_id` filter on an admin query is an instant cross-user leak. Standing code-review rule.

---

## Episode Script

Draft exists: `C:\Users\wuazn\Downloads\productbykel-crateiq-episode-script.md`

**Known discrepancy in that file:** The pre-filming checklist says "acquire crateiq.app domain" — this is dead. CrateIQ is off the table (domain confirmed unavailable, product conflict). Replace with the actual name once locked.

**Script structure:** Hook → DJ footage intro → Feature showcase (Track ID, Library Intelligence, Themed Crates, Setlist) → How I built it (4-phase workflow, 2-call pipeline, Spotify pivot, design system, 3 lessons) → Close + Episode 2 tease. Target 8–12 min.

---

## Video Story Arc (build-in-public, developer story)

Audience: **fellow builders/developers**, not DJs being sold to. The DJ project is the context; the story is about building with AI dev tools.

1. **Open:** "I'm a DJ. I built a personal project using Claude Code. This is a developer story."
2. **The hook:** "When I posted about it, the DJ community pushback was harsh — 'you shouldn't need AI to plan sets.' They're right. So I made a cut."
3. **The pivot:** "I'm not building AI to replace creative work. I'm building AI to handle the grunt work — track ID, library data, mix tracklisting. The DJ stays the creative force."
4. **The strategic cut:** "I looked at competitors. PulseDJ already does live AI for free. Banger Button owns real-time suggestions. So I went all-in on the one place no one covers end-to-end: the complete pre-gig system."
5. **The engineering:** "First job — make it feel like one app. Here's the design-system overhaul. Before/after."
6. **The magic moment:** "Track ID v2 — upload a mix → full timestamped tracklist."
7. **Augmenting the library:** "Themed crates on demand from your own tracks."
8. **The takeaway:** "Here's what building this with Claude Code taught me about positioning AI as a co-pilot, not a replacement."
9. **What's next:** "Post-gig reflection — closing the loop. That's Episode 2."

---

## Pending Decisions

- **External services rename** — `brand.ts` is updated. Still to do before launch:
  - `NEXT_PUBLIC_APP_URL` env var → `https://setlab.ai` (Vercel)
  - DNS: point `setlab.ai` to Vercel project
  - GitHub repo rename (cosmetic — clone URLs change)
  - Vercel project rename (cosmetic)
  - Supabase project name (cosmetic)
  - Stripe product names
  - ACRCloud project name
  - Resend "from" email and templates
- **Episode framing:** Developer story vs DJ tool demo — lean developer story per the co-pilot principle.
- **Phase 4 timing:** Deferred. Needs a real gig recorded after this video ships.

---

## Recent Commits

```
3c76998 chore: nightly context update 2026-06-26
8722750 chore: nightly context update 2026-06-25
0660add chore: nightly context update 2026-06-24
54f85cd chore: nightly context update 2026-06-23
3104c12 chore: nightly context update 2026-06-22
2a3b146 chore: nightly context update 2026-06-21
001e345 chore: nightly context update 2026-06-20
285ce73 chore: nightly context update 2026-06-19
2fcb3ba chore: nightly context update 2026-06-18
df66195 chore: nightly context update 2026-06-17
10de3aa chore: nightly context update 2026-06-16
aa499f4 chore: nightly context update 2026-06-15
549f8c6 chore: nightly context update 2026-06-14
8b8997d chore: nightly context update 2026-06-13
d124bea chore: nightly context update 2026-06-12
571666e fix(analyze-gaps): guard against undefined return from fetchBpmGapRecs
dfdb027 fix(dashboard): null-guard recommendations and emergingArtists before map
cfc298e fix(wordplay): remove verbatim lyric quoting to avoid content filter
39a1818 fix(analyze-gaps): surface real error message + graceful Claude fallback
c57d5e4 fix(dashboard): move Discover above setlists; fix 504 on analyze-gaps
```

---

## For Episode Discussion

Key questions still open:

1. **App name** — must be locked before filming. See Pending Decisions above.
2. **Hook framing** — how explicit to be about DJ community pushback? Real comments/DMs or paraphrase?
3. **Magic moment capture** — which mix file to use for the Track ID v2 demo? Use your own recording to avoid copyright flags.
4. **Crates demo prompts** — "Friday peak 1am — dark afrobeats, high energy" and "warmup set, soulful house" are strong candidates.
5. **Length** — script targets 8–12 min. Identify which sections to cut if running long.
6. **Episode 2 tease** — how much to reveal about post-gig reflection at the end?

---

*Last updated: 2026-06-27*
