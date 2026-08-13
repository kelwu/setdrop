# SetLab × Loops — Campaign Build Handoff

> Paste-ready brief for the Claude instance building SetLab's email marketing in Loops.
> Companion to `setlab-campaign-brief.md` (the full product/messaging brief). Last updated: 2026-08-13.

You're building SetLab's email marketing in Loops. The SetLab backend now emits all the contact data you need — your job is to build the **segments and campaigns** in Loops on top of it. Primary goal: **convert free users to Pro ($12/mo).**

## Source of truth

The repo `kelwu/setlab` has **`setlab-campaign-brief.md`** — read it in full. §1–7 = product, positioning, brand voice, and campaign angles; **§8 = the exact Loops data contract**; §9 = accuracy guardrails. Everything below is the short version of §8, but read the whole brief for voice and framing.

## What's live in prod now

Keyed by contact **email** (the SetLab account email). All calls are fire-and-forget / best-effort — treat them as signals, not guaranteed exactly-once.

### Contact properties (for segmentation — these send nothing themselves)

| Property | Type | Values | Set when |
|---|---|---|---|
| `subscriptionTier` | string | `'free'` \| `'pro'` | Signup → `free`; Pro upgrade → `pro`; churn/downgrade → `free`. Current both directions. |
| `signedUpAt` | string | `YYYY-MM-DD` | Once, at signup. |
| `libraryImported` | boolean | `true` | After first successful library import. Unset = never imported. |
| `setlistsGenerated` | number | running **all-time** total | After every set generation. |

### Events (campaign triggers)

| Event | Data fields | Fires when |
|---|---|---|
| `signup` | — | New user (Google OAuth or email). |
| `first_setlist` | `setName` (string) | User's all-time setlist count reaches 1. |
| `setlist_quota_warning` | `used` (number), `limit` (number, `3`) | A **free** user hits 2 sets in a rolling 30-day window — one before the cap. |

## Rules

- **Do not create or rename properties/events** — use these exact names; they already exist on the contact.
- Properties **segment**; events **trigger**.
- Free is genuinely usable (unlimited generation, 3 exports/mo) — the upgrade angle is exports + power-use, never "generation is locked."
- Keep the **co-pilot, not autopilot** framing (AI preps, the DJ mixes). SetLab is in **beta**. Don't invent metrics.

## Suggested first campaigns (see brief §7 for angles)

1. **Onboarding** — `signup` → welcome + "import your library" nudge.
2. **Activation** — `libraryImported = true` AND `setlistsGenerated = 0` → "build your first set."
3. **Upgrade nudge** — trigger on `setlist_quota_warning` (free) → "1 set left, go unlimited."
4. **Power-user upgrade** — `subscriptionTier = 'free'` AND `setlistsGenerated ≥ 10` → Pro pitch.
5. **Win-back** — `subscriptionTier = 'free'` who churned from `'pro'`.

## Report back

Confirm which of these already exist in Loops vs. need building, and flag any property you wish existed but doesn't — the SetLab backend can add the signal rather than you creating a stray property.
