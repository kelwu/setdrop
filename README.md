# SetLab

**AI-powered DJ prep tool.** Import your Serato or Rekordbox library, describe your gig, and get an ordered setlist with transition notes, harmonic mixing logic, and per-track reasoning — then export directly back to your DJ software.

Live at [setlab.ai](https://setlab.ai)

---

## What It Does

SetLab handles the grunt work of DJ prep so the creative decisions stay with you.

- **Setlist Generator** — AI builds a starting point from your actual library. Click any track to see why it was chosen, how to transition into the next one, and the harmonic mixing logic behind every move.
- **Library Intelligence** — Analyzes your collection by sub-genre, surfaces BPM gaps, and finds emerging artists in your genres via live web search.
- **Track ID** — Tap to identify any track instantly via ACRCloud fingerprinting. Upload a full DJ mix and get a complete timestamped tracklist.
- **Themed Crates** — Describe a vibe in plain English. SetLab filters and sequences tracks from your library that match.
- **Wordplay Studio** — Enter a word, find every track in your library connected to it, get suggested transition pairs.
- **Multi-format export** — Serato `.crate`, Rekordbox XML, M3U.

---

## Stack

- **Framework:** Next.js 16, React 19, TypeScript, Tailwind v4, Shadcn/ui
- **Auth + DB:** Supabase (Postgres + RLS + Auth)
- **AI:** Anthropic Claude (`claude-sonnet-4-6`) — setlist generation, BPM/key enrichment, themed crate parsing
- **Track ID:** ACRCloud audio fingerprinting
- **Enrichment:** Last.fm (mood/energy tags), Beatport (BPM/key)
- **Billing:** Stripe (Free + Pro tiers)
- **Hosting:** Vercel

---

## Pricing

| Tier | Price | Limits |
|------|-------|--------|
| Free | $0 | Unlimited set & crate generation · 3 exports/month · 10 Track IDs/month |
| Pro | $12/month | Unlimited exports · unlimited generation · 500 Track IDs/month |

---

## Built By

[Kel Wu](https://setlab.ai) — PM by day, DJ by night.
Follow the build: [@productbykel](https://youtube.com/@productbykel)
