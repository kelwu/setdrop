# SetDrop — Session Context

*Drop this file into any Claude conversation to continue building SetDrop without re-explaining the project.*

---

## What It Is

A personal DJ hobby project (the builder's own) using Claude Code + AI to handle the **grunt work** around DJing — track ID, library data, gig context, post-gig analysis. **Not** trying to replace creative work. The DJ stays the creative force; SetDrop handles tooling.

**Strategic position:** Own the complete pre-gig system end-to-end. Track ID → wishlist → library intelligence → gig-context AI generation (as a starting point the DJ tweaks) → multi-format export → post-gig reflection feeding next pre-gig. **Live mode parked** (PulseDJ owns that axis free, multi-DAW). Build-in-public video is a **developer story**, not a vendor pitch.

---

## Live Infrastructure

- **Vercel:** https://setdrop-phi.vercel.app
- **GitHub:** https://github.com/kelwu/setdrop (auto-deploys `main`)
- **Supabase:** project `ukyebaaosqzdesbxsrzk` (us-east-1)
- **Local:** `C:\Users\wuazn\Desktop\Product by Kel\Projects\setdrop` — dev on `localhost:3001`
- **Stack:** Next.js 16, React 19, Supabase, Vercel, Anthropic `claude-sonnet-4-6`, ACRCloud

---

## Pricing

- Free: 5 sets/mo, 10 Track IDs/mo
- Pro: $12/mo — 50 sets/mo, 500 Track IDs/mo ("unlimited" marketing)
- Billing: Stripe checkout + webhook + billing portal

---

## Shipped Features

**Core pipeline** — AI setlist generation (`/api/generate-setlist`), streaming SSE, 2-call pipeline: `runGigBlueprint` (web search venue/trend) → `runSelectorReviewer`. **Do NOT refactor.**

**Library / import**
- Serato DB V2 binary parse (`/api/library/parse-db`)
- Rekordbox XML parse (client-side)
- Library save/sync, insert-first diff (`/api/library/save`)
- Spotify OAuth → wishlist; Last.fm tag enrichment; Claude BPM/key enrichment (50-row cap)

**Export** — Serato `.crate` (`src/lib/setdrop/serato-crate.ts`), Rekordbox XML + M3U (`src/lib/setdrop/rekordbox-export.ts`), public share pages (`/set/[slug]`).

**Dashboard intelligence**
- Library Intelligence: percentile BPM gap detection + AI track recommendations
- Trending by Genre: two-phase forced web search, 24h cache, `maxDuration=120`
- Dashboard redesign: compact status strip (28px display numbers), Next Gig countdown widget (≤7 days accent), tabbed Discover (Trending | Library Gaps)

**Track ID v1** — Mic (tap-to-stop 5–15s) + file upload, ACRCloud (`src/lib/setdrop/acrcloud.ts`), library/wishlist dedup badges, quota 10 free/500 pro. Entry: desktop nav, mobile bottom nav (◎), Dashboard "ID a Track" button. Env: `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_ACCESS_SECRET`, `ACRCLOUD_HOST`.

**Community + auth** — Explore feed + likes with unique constraint; email/Google OAuth; account delete (auth first, data cleanup best-effort); Stripe webhook uses `createAdminClient()`.

**Design system foundation (just shipped)** — `SD` object now has spacing scale (`s1`–`s9`), type scale (`t10`–`t72`), semantic colors (`success`/`warning`/`danger`/`info` + dim variants), border radius scale (`r1`–`r4`), accent-usage discipline documented. Legacy aliases kept for back-compat. Foundation only — no components refactored yet.

---

## Hard Constraints (CLAUDE.md)

- Serato `database V2` is **read-only** — never write
- Only write new `.crate` files to `Subcrates/`
- `setlists.tracks_json` is source of truth — not `setlist_tracks` junction
- Never read/modify/write MP3 audio — metadata only
- Invoice generation only — no payment processing
- Pipeline core (`computeLibraryProfile` → `runSelectorReviewer`) — do NOT refactor

---

## Co-Pilot Principle

AI is good at: track ID, BPM/key detection, library data, tracklist annotation, multi-format export, surfacing options. AI shouldn't own: "pick your closing track", live in-set suggestions, "generate your perfect set" framing. Existing AI set generation stays but framed as a **starting point** the DJ tweaks.

---

## Active Plan (7-9 weeks) — `plans/compressed-dreaming-cocke.md`

1. **Weeks 1-3: Design System Unification** — *Phase 1.1 ✅ tokens shipped. Phase 1.2 ✅ primitives shipped (`PageHeader`, `Card`, `CardHeader`, `Tabs`, `Badge`, `EmptyState`, `LoadingState` in `shared.tsx`).* Next: page refactors (1.3) → mobile pass (1.4) → color semantics audit (1.5) → publish→Explore loop + Wordplay→Builder (1.6).
2. **Week 4: Track ID v2** — paste SoundCloud/Mixcloud URL → full timestamped tracklist via ACRCloud DJ Mix Recognition.
3. **Weeks 5-6: Library Intelligence v2 + Themed Crates** — sub-genre awareness, emerging artists; `/api/crates/generate` for "warmup", "wedding cocktail", etc.
4. **Week 7: Post-gig Reflection** — upload recording → planned vs actual energy arc, track-level diff, pattern surfacing. **Pure data, no prescription.**
5. **Week 8: Build-in-public capture + script.**

---

## Recent Commits

```
4ce5645 feat(design-system): Phase 1.2 — shared primitives PageHeader, Card, Tabs, Badge, EmptyState, LoadingState
03eefc5 feat(design-system): Phase 1.1 — extend SD with spacing, type, semantic-color, and radius scales
435ea70 docs: update setdrop-context.md with strategic pivot
f9c3c23 chore: add nightly context updater GitHub Action
69302df feat: Track ID nav home (desktop link, mobile nav, dashboard CTA)
afe0f15 fix: AbortController timeout on trending fetch
f2f423b fix: restore status strip visual weight — 28px display numbers
2c8c52f feat: dashboard UI refresh — status strip, Next Gig, tabbed Discover
80f5a44 feat: Track ID v1 — mic + file upload via ACRCloud
e54829e fix: low-severity issues from Opus final review
aa123c0 fix: library save atomicity, BPM enrichment cap, Spotify batch insert
fc760aa fix: critical Stripe webhook RLS bug, account delete safety
```

---

*Last updated: 2026-06-06*
