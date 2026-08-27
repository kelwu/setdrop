# SetLab — Email Knowledge Pack (for Loops campaigns)

> **Purpose:** Single, self-contained source of truth for **Claude Cowork** to write and revise SetLab emails sent through the **Loops API**.
> **Rule:** Everything here is ground truth — do not invent features, metrics, pricing, or Loops properties that aren't listed. When unsure, leave it out.
> **Last updated:** 2026-08-26.
> **Sources merged:** product messaging brief + in-app help knowledge base (canonical feature behavior).

---

## 1. What SetLab is

**SetLab** (setlab.ai) is an **AI co-pilot for DJs** that connects the whole DJ workflow — **from building your library to walking into the booth ready to play.** Built by **Kel Wu** (DJ Kelton Banks) — PM by day, DJ by night. Follow the build at **@productbykel** on YouTube and Instagram.

- **Tagline:** *From library to setlist.*
- **Status:** Public **beta**.
- **One-liner:** Upload your DJ library, and SetLab enriches it, plans your set for the exact gig, and exports it straight back to Serato or Rekordbox.

### The core principle — frame EVERYTHING through this
SetLab is a **co-pilot, not an autopilot.** It does the grunt work — analyzing thousands of tracks, matching keys, pacing energy, flagging what you've already played — so the **DJ keeps full creative control**. The AI hands you a *starting draft*; you make the creative call.

- ✅ Say: *"AI clears the busywork so you can focus on the mix."*
- ❌ Never say: *"AI replaces the DJ"* / *"AI picks your set."*

---

## 2. Who it's for (ICP)

- Working/gigging DJs — clubs, weddings, corporate, lounge, festivals, open-format.
- **Serato AND Rekordbox** users (both first-class).
- DJs with large libraries who spend hours prepping crates and setlists by hand.
- Both established DJs (want speed) and newer DJs (want guidance on harmonic mixing, energy arcs, transitions).

---

## 3. The two things SetLab makes — keep these DISTINCT

This distinction was recently clarified in-product and matters for email clarity. Never blur them.

| | **Set (Setlist)** | **Crate** |
|---|---|---|
| **What it is** | A full, **ordered performance plan** for one specific gig | A **themed collection** of tracks from your library that fit a vibe |
| **Analogy** | The set you play, top to bottom | The record bag you draw from |
| **Answers** | *"In what order do I play these for this gig?"* | *"Which of my tracks fit this vibe?"* |
| **You give it** | Venue, crowd, duration, lineup slot | A plain-English vibe ("Friday peak 1am", "wedding cocktail hour") |
| **You get** | Start-to-finish sequence with transition notes, harmonic logic, energy arc, timing | A named crate loosely ordered by energy curve |
| **Built with** | **Build Set** | **Crates** page |

Both are AI-generated **from your own library** and both export to Serato (.crate), Rekordbox XML, or M3U.

---

## 4. Feature catalog (lead with the benefit, support with the feature)

### Library
- **Import & instant search** — Upload your Serato "database V2" file or a Rekordbox XML export; the library becomes searchable in seconds. *SetLab never modifies your original Serato/Rekordbox files.*
- **AI enrichment** — Tracks auto-tagged with BPM, key, energy score, and genre tags.
- **Library Intelligence (Dashboard)** — Surfaces BPM gaps, sub-genre coverage, energy gaps, and emerging artists in your genres (live web search). It's **data, not decisions** — SetLab shows the numbers; you decide.
- **Trending charts** — By genre, refreshed every 24 hours.

### Set Builder (the flagship — "Build Set")
- **Built for the exact gig** — Set genre, crowd, energy arc, duration, and lineup slot; AI architects a set from *your* library.
- **Multi-axis pool** — Define the set by **genre, era, and/or artist**, or from a **Rekordbox playlist** — not just genre.
- **Opener / Headliner mode** — Pacing and energy adapt to your slot on the lineup.
- **Harmonic (Camelot) mixing** — Builds harmonically adjacent chains so transitions actually blend.
- **Genre-specific transition rules** — Afrobeats→House follows different BPM rules than Hip-Hop→R&B.
- **Genre-aware pacing** — Set length paces by how each genre is actually mixed (~3 min/track for house, faster open-format, longer lounge).
- **Do-Not-Repeat logic** — Tracks used in recent sets are flagged/excluded so you don't replay yourself.
- **Seed tracks** — Name must-play tracks; they're guaranteed a spot.
- **Wordplay (hip-hop)** — Sequences tracks so a chosen word/phrase bridges songs lyrically.
- **Per-track notes** — Each track shows *why it was chosen* and *how to transition* into the next.
- Every generated set is a **starting point** — you swap, reorder, and customize.

### Crate Builder ("Crates")
- **Describe a crate in plain language** → a curated crate from your library.
- **Precise filters** — Genre, BPM range, year range, exclude artists, clean-only.
- **Fills to your requested size** — Ask for 25, get 25; if exact-genre matches fall short it tops up from the wider genre family and tells you the exact-vs-filled split (no silently short crates).
- **Genre column** — See each track's genre at a glance.
- **Important:** Crates only use tracks you **already own** — they don't suggest tracks you don't have.

### Track ID
- Identifies tracks via **ACRCloud audio fingerprinting**. Two flows: **Quick ID** (record a 5–15s clip, or upload an audio file up to 10MB) for a single track, and **Mix Tracklist** (upload a full mix file up to 200MB) to get a timestamped tracklist for an entire mix. Results add straight to your wishlist. (Free: 10/mo; Pro: 500/mo; a full mix counts as more than one.)

### Export & platforms
- **One-click export** — Serato `.crate`, Rekordbox XML, or M3U.
- **Works with your tools** — Serato DJ, Rekordbox. **Purchase bridge**: links to Beatport, Traxsource, BPM Supreme, DJcity to buy tracks you don't own yet (it *links*, it doesn't buy).

### More
- **Post-Gig Reflection** — Upload a recording; SetLab IDs what you actually played (timestamped) and overlays planned vs actual energy arc + track-level diff. Pure analytics, no judgment.
- **Explore** — Community feed; browse/like other DJs' published sets, publish your own with a shareable link.
- **Wishlist** — Tracks you want and where to buy them.
- **Help guides** — Step-by-step visual walkthroughs at **setlab.ai/help** (import, plan a set, build a crate). In-app help chat links straight to them and **answers in whatever language you write in**.

### Not supported / boundaries (don't overclaim)
- **No Traktor or VirtualDJ** (Serato + Rekordbox only).
- **Not live** — it's a pre-gig prep tool; no real-time connection to your DJ software.
- It does **not** stream, host, or mix audio for you. It plans and exports; the DJ mixes.
- Your library is **private** — only sets you explicitly publish are public.

---

## 5. Pricing

| | **Free** | **Pro — $12/mo** |
|---|---|---|
| AI set & crate generation | Unlimited* | Unlimited |
| Exports (Serato / Rekordbox / M3U) | **3 / month** | Unlimited |
| Track IDs | 10 / month | 500 / month |
| Library upload + BPM/key enrichment | ✓ | ✓ |

- No credit card for Free. Cancel Pro anytime (keep access to end of billing period).
- \*Free generation is "unlimited for normal use" with a light daily anti-abuse cap.
- **The paywall is on EXPORTS, not generation.** Never imply generation is paywalled. The natural Pro trigger: *"I've built sets I love and want to load more than 3/month into my gear."*

---

## 6. Brand voice

- **DJ-native, confident, no fluff.** Short punchy lines. Talks like it's been in the booth.
- **Signature phrases:** *"Hit the decks." "Do not repeat." "Your library. Your set." "Your next set starts here."*
- **Respect the craft** — the DJ is the artist; SetLab is the crew that preps the gear.
- **Visual identity:** dark UI, **amber accent (#F5A623)**, mono + display type. Email design: clean, high-contrast, minimal.
- **Avoid:** hype-y "revolutionary AI" language, replacing-the-DJ framing, generic SaaS voice.

---

## 7. What's New (changelog — for feature-announcement emails)

Most recent first. Convert into "we just shipped…" emails. Frame the **DJ-facing benefit**, not the internal fix.

- **Faster, more reliable set generation** — set-building is quicker and no longer times out on long/complex sets. *(Reliability/speed win — only worth an email as a light "runs smoother now" aside, not a headline.)*
- **Step-by-step visual guides** — new walkthroughs for importing your library, planning a set, and building a crate, at setlab.ai/help. The help chat links you straight to them.
- **Ask SetLab, in your language** — in-app help chat now remembers the conversation (follow-ups like "show me" work) and answers in whatever language you write in.
- **Set vs Crate, made clear** — plan an *ordered set* for a gig, or build a *reusable crate* by vibe. Distinct names, framing, and side-by-side entry points on your dashboard.
- **Genre column in the Crate Builder** — see each track's genre in the crate list.
- **Crates fill to your requested size** — ask for 25, get 25 (topped up from the wider genre family, with a transparent split).
- **Sharper genre matching** — off-genre tracks (a rock/country tune in a house set) no longer slip into the pool; readiness check reflects true in-genre depth.
- **Genre-aware set pacing** — set length reflects how each genre is actually mixed.
- **Multi-axis set pool** — build a set by genre, era, and/or artist, not just genre.
- **Build a set from a Rekordbox playlist** — point the builder at an existing playlist.
- **Thin artist sets auto-expand** — pick an artist and SetLab widens to similar artists to fill the set.

---

## 8. Loops data contract (REQUIRED for targeting & personalization)

This is the exact schema the SetLab backend sends to Loops. Build segments and campaigns against **these** names — do **not** invent or rename properties. Everything is keyed by the contact's **email** (their SetLab account email). All calls are fire-and-forget → treat as best-effort signals, not exactly-once.

**Properties** describe *who the contact is* (segmentation, send nothing on their own). **Events** are *moments* you trigger campaigns off.

### Contact properties (segmentation)

| Property | Type | Values | Set when |
|---|---|---|---|
| `subscriptionTier` | string | `'free'` \| `'pro'` | Signup → `free`; Pro upgrade (Stripe) → `pro`; churn/downgrade → `free`. Always current both directions. |
| `signedUpAt` | string | `YYYY-MM-DD` | Once, at signup. |
| `libraryImported` | boolean | `true` | After first successful library import. (Absent/unset = never imported.) |
| `setlistsGenerated` | number | running **all-time** total | After every set generation. All-time, **not** monthly. |

Contact is created at signup (`source: 'setlab-signup'`).

### Events (campaign triggers)

| Event | Data fields | Fires when |
|---|---|---|
| `signup` | — | New user signs up (Google OAuth or email). |
| `first_setlist` | `setName` (string) | User's all-time setlist count reaches **1**. |
| `setlist_quota_warning` | `used` (number), `limit` (number, currently `3`) | A **free** user reaches **2 sets in a rolling 30-day window** — the "1 left, go unlimited" nudge. |

### Segment building blocks (combine the above)

- **Onboarding — signed up, never imported:** `libraryImported` unset (any tier).
- **Activation — imported but stalled:** `libraryImported = true` AND `setlistsGenerated = 0`.
- **Upgrade — engaged free power user:** `subscriptionTier = 'free'` AND `setlistsGenerated ≥ N`.
- **At-the-wall upgrade:** trigger off `setlist_quota_warning` (free tier only).
- **Win-back — churned Pro:** `subscriptionTier = 'free'` who previously had `'pro'` (churn flips this back, so they re-enter free segments automatically).
- **Time-based:** `signedUpAt` for anniversary / age-of-account drips.

---

## 9. Campaign angles & segments (starting points)

**Angles**
- *"Stop prepping crates by hand."* — time saved on library/crate work.
- *"Built for the gig, not a generic playlist."* — crowd/slot/energy-aware sets.
- *"Never replay yourself."* — do-not-repeat + reflections.
- *"Serato or Rekordbox — one click to the booth."* — export/interop.
- *"It learns your taste."* — reflections → better sets over time.

**Segments → angle pairing**
- **New signups (no library yet):** drive first import → first set. Activation.
- **Imported but never generated:** nudge to build their first set for a real upcoming gig.
- **Free users near 3-export cap:** upgrade prompt (the natural Pro trigger).
- **Active builders:** feature-announcement drips (§7 What's New).
- **Lapsed:** "your library's still here — here's what's new since you left."

---

## 10. Accuracy guardrails (don't overclaim)

- SetLab is in **beta** — fine to say so; conveys "early, improving fast."
- Landing-page stats (e.g. "2,400+ tracks analyzed", "98% key accuracy", "<30s set generation") are **existing marketing figures** — reuse them, don't invent new metrics.
- It does **not** stream/host music or mix audio — it plans and exports; the DJ mixes.
- Purchase bridge **links to** stores; it doesn't buy tracks.
- Pricing is **$12/mo Pro**; Free is genuinely usable (unlimited generation, 3 exports/mo). Don't imply generation is paywalled.
- No Traktor / VirtualDJ; not a live tool.
- Always keep the **co-pilot, not autopilot** framing (§1).
