# Track ID — Build Spec

**Status:** Ready to build — decisions resolved
**Owner:** Kel Wu
**Target ship:** v1 in 2 weeks, v2 a month later
**Last updated:** 2026-06-04

---

## Problem

Every DJ has a running mental list of "what was that track?" — they hear something at another DJ's set, scroll a SoundCloud mix at home, see an Instagram reel with a clip, or get asked at a wedding. Today they fragment this across:

- Shazam (consumer; misses DJ pre-releases, edits, dubs)
- AHA Music browser extension (works on SoundCloud/YouTube but no library context)
- 1001Tracklists (manual lookup, depends on someone else having ID'd the mix)
- Discord groups asking "ID please"
- Notes app / phone memo to remember later

Then they have to manually transfer the IDed track to a wishlist somewhere, look up BPM/key, generate a Beatport search URL, etc. **Five apps for one workflow that should be a single tap.**

## The wedge

Shazam ends at "here's the track name." SetDrop's wedge: ID → BPM/key enrichment → wishlist → Beatport/DJcity search URL → candidate for the next AI-generated set. The IDed track immediately becomes part of the DJ's library intelligence — flagged for compatibility with what they already play. No standalone music-ID tool does this.

## Out of scope for v1

These are valid follow-ups, deliberately not in v1:
- ❌ URL paste mode for mixes (SoundCloud / YouTube full-mix tracklist) — legal/technical complexity; defer to v2
- ❌ Community ID feed ("submit this clip, other DJs guess") — v3
- ❌ Real-time mic streaming (continuous listening) — battery/UX cost too high for v1
- ❌ Mobile-native app — web only, mobile-web PWA acceptable

---

## User stories

**As a DJ at home scrolling Instagram:**
> I see a reel of a DJ set with an unknown track. I tap the SetDrop button in my browser, record the audio playing through my speakers (or upload a screen recording), and within 10 seconds get the artist/title with a "Add to Wishlist" button. The track is now in my SetDrop wishlist with BPM and key, ready for next Saturday's gig.

**As a DJ at another DJ's gig:**
> Track playing in the club, I open SetDrop on my phone, tap Record, hold it up for 10 seconds. Track ID'd, saved. Done.

**As a DJ working on a mix at home:**
> I downloaded an MP3 of a vintage set someone sent me. I drag the file into SetDrop, it identifies the track, I add it to my wishlist.

**As a SetDrop power user:**
> I notice a "Already in your library!" badge sometimes when ID'ing a track. Surprise delight — I forgot I owned that.

---

## UX flow

### Entry points (v1)

1. **Global nav icon** — microphone glyph in the top nav, visible on every page
2. **Wishlist page button** — "+ ID a Track" alongside "+ Add Manually"

### Main flow

```
┌──────────────────────────────────────────────────┐
│ ← Back                                    [×]    │
│                                                  │
│  ID A TRACK                                      │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │            🎤 Tap to Record                │  │
│  │                                            │  │
│  │         Hold up to the speaker             │  │
│  │       Tap again to stop (5-15s)            │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ─── or ───                                      │
│                                                  │
│  📁 Upload audio file                            │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Recording state

```
┌──────────────────────────────────────────────────┐
│                                                  │
│       ●●●●●●●●●●●○○○○○○○○ 6s (min 5 · max 15)   │
│                                                  │
│         [animated waveform / pulse]              │
│                                                  │
│              [Tap to Stop]                       │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Processing state

```
┌──────────────────────────────────────────────────┐
│                                                  │
│         🎧  Identifying...                       │
│                                                  │
│         [spinner]                                │
│                                                  │
│  Usually takes 2-5 seconds                       │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Result — match found

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  ✓ MATCH FOUND                                   │
│                                                  │
│  Boys Don't Cry — Anyma Remix                    │
│  Anyma, Aliya Janell                             │
│                                                  │
│  127 BPM · 8A · Tech House · 2026                │
│                                                  │
│  ⚠ Already in your library                       │
│  (or)                                            │
│  📌 Already in your wishlist                     │
│                                                  │
│  [+ Wishlist]  [Beatport ↗]  [Try Another]       │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Result — no match

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  ✗ NO MATCH                                      │
│                                                  │
│  Probably an unreleased / promo / dub.           │
│                                                  │
│  [Try Recording Again]   [Add Manually]          │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Result — multiple candidates

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  3 POSSIBLE MATCHES                              │
│                                                  │
│  ◉ Boys Don't Cry — Anyma Remix (95%)            │
│    127 BPM · 8A · Tech House                     │
│                                                  │
│  ○ Boys Don't Cry — Original (62%)               │
│    100 BPM · 8A · Pop                            │
│                                                  │
│  ○ Boys Don't Cry — Acoustic (45%)               │
│    98 BPM · 8A · Acoustic                        │
│                                                  │
│  [+ Wishlist Top Pick]   [Try Again]             │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Quota exhausted (free tier)

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  ⚠ Out of free IDs this month                    │
│                                                  │
│  You've used your 10 free IDs.                   │
│  Upgrade to Pro for unlimited.                   │
│                                                  │
│  [Upgrade to Pro — $12/mo]                       │
│                                                  │
│  Resets in 14 days.                              │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Technical architecture

### Provider selection

**Primary: ACRCloud**
- Best DJ/electronic catalog coverage
- Has "DJ Mix Recognition" tier (relevant for v2 URL paste)
- Pricing: ~$0.003 per identification call
- REST API + JS SDK
- Reliable, used by Pacemaker and others in the space

**Alternative: Audd.io** (backup if ACRCloud pricing escalates)
- Cheaper (~$0.001/call) but smaller catalog
- Simpler API
- Good fit if ACRCloud's coverage proves overkill

**Not used:**
- Shazam SDK (iOS-locked, not web-compatible)
- Open-source (Dejavu, Olaf) — quality not competitive with commercial APIs

**Decision:** Start with ACRCloud. Wrap it behind a `MusicRecognitionProvider` interface so we can swap if pricing/quality changes.

### Data flow — mic / upload mode

```
Browser                Next.js API           ACRCloud         Supabase
  │                       │                     │                │
  ├── MediaRecorder ──┐   │                     │                │
  │   10s @ 16kHz mono│   │                     │                │
  │                   │   │                     │                │
  ├─ POST multipart ──┼──>│                     │                │
  │  /api/track-id    │   │                     │                │
  │                       ├── check quota ──────┼───────────────>│
  │                       │<── ok ──────────────┼────────────────┤
  │                       │                     │                │
  │                       ├── audio + key ─────>│                │
  │                       │<── match result ────┤                │
  │                       │                     │                │
  │                       ├── log request ──────┼───────────────>│
  │                       ├── check library/    │                │
  │                       │   wishlist dedup ───┼───────────────>│
  │<── result JSON ───────┤                     │                │
  │                       │                     │                │
  │ [User taps Wishlist]  │                     │                │
  ├── POST ──────────────>│                     │                │
  │  /api/wishlist/add    ├── insert ───────────┼───────────────>│
  │                       │                     │                │
  │  [Background]         ├── enqueue BPM/key   │                │
  │                       │   enrichment        │                │
```

### API endpoints

#### `POST /api/track-id`

Identifies a track from an audio sample.

**Request** (multipart/form-data):
- `audio` — File or Blob, ≤ 10MB, ≤ 30 seconds, formats: webm/mp3/wav/m4a
- `source` — `'mic' | 'upload'`

**Response 200:**
```json
{
  "matched": true,
  "candidates": [
    {
      "artist": "Anyma, Aliya Janell",
      "title": "Boys Don't Cry — Anyma Remix",
      "bpm": 127,
      "key": "8A",
      "genre": "Tech House",
      "year": 2026,
      "confidence": 95,
      "externalProvider": "acrcloud",
      "externalMatchId": "abc123",
      "beatportSearchUrl": "https://www.beatport.com/search?q=Anyma+Boys+Don't+Cry"
    }
  ],
  "alreadyInLibrary": false,
  "alreadyInWishlist": false,
  "quotaRemaining": 8
}
```

**Response 200 (no match):**
```json
{ "matched": false, "quotaRemaining": 7 }
```

**Response 429 (quota exhausted):**
```json
{ "error": "quota_exhausted", "tier": "free", "limit": 10, "resetsAt": "2026-07-01T00:00:00Z" }
```

**Response 401:** Not authenticated.

#### `POST /api/track-id/save`

Adds an IDed track to the wishlist. Reuses existing wishlist insertion logic — no new code path, just a thin wrapper that also marks the `track_id_requests` row as `added_to_wishlist = true`.

**Request:**
```json
{ "requestId": "uuid", "candidateIndex": 0 }
```

### Database schema

```sql
CREATE TABLE track_id_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('mic', 'upload', 'url')),
  matched boolean NOT NULL DEFAULT false,
  candidates_json jsonb,           -- full result from provider
  external_provider text,
  added_to_wishlist boolean DEFAULT false,
  added_wishlist_id uuid REFERENCES wishlist_tracks(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX track_id_requests_user_month
  ON track_id_requests(user_id, date_trunc('month', created_at));

ALTER TABLE track_id_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY track_id_requests_owner ON track_id_requests
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**Quota check (read-side):**
```sql
SELECT count(*) FROM track_id_requests
WHERE user_id = $1
  AND created_at >= date_trunc('month', now());
```

**Why not store the raw audio?** Privacy + storage cost. We send the audio to ACRCloud, get the result, drop the audio. The `candidates_json` retains everything we need for debugging.

---

## Quota / pricing

| Tier | IDs/month | Marginal cost (ACRCloud @ $0.003) |
|------|-----------|------------------------------------|
| Free | 10 | $0.03/user |
| Pro ($12/mo) | Unlimited (soft cap 500/mo to prevent abuse) | up to $1.50/user |

**Reasoning:**
- 10 free IDs is generous enough to demonstrate the feature without hemorrhaging cost
- Pro users won't hit the 500 soft cap in normal use (would be 16/day every day)
- At $12/mo Pro, ID cost is < 15% of revenue — healthy margin

**Conversion lever:** When a free user hits ID #8 or #9, show "2 IDs left this month — upgrade for unlimited" inline.

---

## Edge cases & failure modes

| Case | Handling |
|------|----------|
| Mic permission denied | Show clear error + retry button + link to browser settings |
| No internet | Optimistic UI fails to provider call; show "Check connection" |
| ACRCloud API down | 5xx response, retry once with backoff, then "Try again later" |
| ACRCloud quota exhausted (our side) | Same as their downtime — surface clearly + alert ops |
| Audio file > 10MB | Reject client-side before upload with size error |
| Audio < 3 seconds | Reject with "Recording too short — try 10 seconds" |
| Audio non-music (talking, silence) | Treat as no-match; show standard no-match screen |
| Multiple equally-confident matches | Show all candidates as multi-select |
| Track already in library | Inline badge "Already in your library" + skip wishlist add |
| Track already in wishlist | Inline badge "Already in your wishlist" |
| Free user double-clicks Record | Disable button while recording + 1 in-flight request only |
| Failed BPM/key enrichment after wishlist add | Save with `null` values, surface "Enrichment pending" |
| User uploads DRM-protected audio | ACRCloud may fail; treat as no-match |

---

## Privacy & legal

- Audio snippets are forwarded to ACRCloud but **not retained** in SetDrop's storage
- ACRCloud's privacy policy applies to the snippet for the duration of their processing (industry-standard: dropped after recognition)
- Update Privacy Policy: add section noting audio is processed by a third-party recognition provider, not stored
- No copyright concern for short snippet uploads (fair-use-style fingerprinting, same legal posture as Shazam)
- **v2 URL paste mode will need separate legal review** — downloading SoundCloud/YouTube audio server-side touches their ToS

---

## Milestones

### v1 — Single-track ID (2 weeks)

**Week 1**
- ACRCloud account + API key + integration test
- `track_id_requests` table migration
- `POST /api/track-id` endpoint (mic + upload modes)
- Quota check against monthly count
- Library/wishlist dedup check
- BPM/key enrichment hook (reuses existing `enrich-bpm-key` pipeline)

**Week 2**
- `/id` page with mic + upload UI
- `MediaRecorder` integration in browser
- Results UI (match, no-match, multi-candidate, quota exhausted)
- "Add to Wishlist" flow + wishlist dedup badge
- Nav integration (microphone glyph)
- Wishlist page entry point
- Privacy policy update

**Ship gate:**
- 95%+ matches return < 5s
- Quota enforcement verified
- Mic permission UX tested on Chrome, Safari, Firefox, mobile Safari

### v2 — URL paste / mix tracklist (3-4 weeks after v1)

- SoundCloud public mix URL → ACRCloud DJ Mix Recognition
- Timeline UI showing track at each timestamp
- Bulk "Add All to Wishlist" / per-track selection
- Legal review for URL extraction
- Consider browser extension as alternative to server-side download

### v3 — Community ID (post-v2)

- Submit unmatched clips to a moderation feed
- DJ commenting / ID suggestions
- Notification when your submitted clip gets ID'd

---

## Success metrics

| Metric | Target (3 months post-launch) |
|--------|-------------------------------|
| **DAU/MAU using Track ID** | 25% of active users use it monthly |
| **IDs per active user per week** | 3 (suggests it's a habit, not a one-time novelty) |
| **ID → wishlist conversion** | 60%+ of successful matches added |
| **Wishlist tracks IDed via Track ID that later appear in a generated setlist** | 15%+ (the deepest engagement metric — closes the loop) |
| **Free → Pro conversion attributable to quota exhaustion** | 5% of free users who exhaust quota convert |
| **Match rate** | 75%+ (lower for promo-heavy users, higher for commercial-track users) |

---

## Decisions (resolved 2026-06-04)

1. **Provider:** ✅ ACRCloud only for v1. Wrap behind a `MusicRecognitionProvider` interface so a fallback (Audd.io) can be added later if pricing or quality changes.
2. **Free quota:** ✅ 10 IDs/month per free user. Generous enough to build a habit; easy to lower later if needed.
3. **Pro soft cap:** ✅ 500 IDs/month soft cap, marketed as "Unlimited" with fair-use language in ToS. Protects against scripted abuse.
4. **Library dedup:** ✅ Show "Already in your library!" badge AND still allow wishlist add. Delight moment + user agency.
5. **Mic UX:** ✅ Tap-to-stop with min 5s, auto-stop at 15s. Best balance of user control + safety bounds. ACRCloud sweet spot for fingerprint quality.
6. **Nav placement:** ✅ Top-nav microphone glyph. Consistent with existing patterns; secondary entry from Wishlist page.
7. **v2 priority:** ✅ URL paste / mix tracklist mode. Highest-leverage solo workflow; community ID deferred to v3.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| ACRCloud catalog misses DJ-relevant tracks | Medium | Test against 50 known DJ tracks before ship; have Audd.io as fallback |
| Pricing creep from ACRCloud | Low | Quotas, monthly cost monitoring, alternative provider ready |
| Browser mic permission UX is awful (especially mobile Safari) | High | Allow file upload as primary alternative |
| Pre-release / promo tracks (high DJ value) have low match rate | High | Set expectations in copy; community ID in v3 fills this gap |
| Users assume it works like Shazam and expect 100% match rate | Medium | Match-rate transparency in marketing |

---

## Appendix — Reference flow code

```typescript
// src/app/api/track-id/route.ts (sketch)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Quota check
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count } = await supabase
    .from('track_id_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', monthStart);

  const tier = await getUserTier(user.id);
  const limit = tier === 'pro' ? 500 : 10;
  if ((count ?? 0) >= limit) {
    return NextResponse.json({ error: 'quota_exhausted', tier, limit }, { status: 429 });
  }

  // Forward to ACRCloud
  const form = await req.formData();
  const audio = form.get('audio') as File;
  const source = form.get('source') as 'mic' | 'upload';

  const result = await identifyWithAcrcloud(audio);

  // Log + dedup check
  const admin = createAdminClient();
  const { data: logRow } = await admin
    .from('track_id_requests')
    .insert({
      user_id: user.id,
      source,
      matched: result.candidates.length > 0,
      candidates_json: result.candidates,
      external_provider: 'acrcloud',
    })
    .select('id')
    .single();

  // Dedup against library + wishlist
  let alreadyInLibrary = false;
  let alreadyInWishlist = false;
  if (result.candidates[0]) {
    const top = result.candidates[0];
    // ...check serato_tracks + wishlist_tracks
  }

  return NextResponse.json({
    requestId: logRow?.id,
    matched: result.candidates.length > 0,
    candidates: result.candidates,
    alreadyInLibrary,
    alreadyInWishlist,
    quotaRemaining: limit - (count ?? 0) - 1,
  });
}
```
