# SetDrop — Project Context for Privacy Policy Drafting

Use this document to draft a privacy policy for SetDrop. It covers what the app is, what data it collects, how it's stored, and which third-party services are involved.

---

## What SetDrop Is

SetDrop is a web application for DJs. It helps DJs plan setlists by:
1. Importing their music library from Serato DJ Pro
2. Using AI (Claude by Anthropic) to generate a custom setlist based on gig context (genre, crowd type, duration, energy arc, venue)
3. Exporting the generated setlist back to Serato as a `.crate` file

**Live URL:** https://setdrop-phi.vercel.app  
**GitHub:** https://github.com/kelwu/setdrop  
**Operator:** Kel Wu (kelcwu@gmail.com)

---

## Tech Stack

| Layer | Service |
|-------|---------|
| Frontend + Backend | Next.js 16 (App Router), deployed on Vercel |
| Database + Auth | Supabase (PostgreSQL, hosted in us-east-1) |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| Planned: Music OAuth | Spotify Web API (OAuth 2.0) |

---

## User Accounts & Authentication

- Users sign up and log in with **email and password**
- Authentication is handled entirely by **Supabase Auth** (no passwords are stored by SetDrop directly — Supabase manages credential storage with bcrypt hashing)
- Sessions are maintained via secure HTTP-only cookies (managed by `@supabase/ssr`)
- Users can sign out at any time from the nav menu

**Data stored on account creation:**
- Email address
- Supabase Auth user ID (UUID)
- Account creation timestamp

---

## Data SetDrop Collects and Stores

### 1. Serato Music Library (user-uploaded)
- When a user uploads their Serato `database V2` file, SetDrop parses and stores:
  - Track artist name
  - Track title
  - BPM
  - Musical key
  - Genre
  - Full file path (as stored on the user's local machine by Serato)
- This data is stored in Supabase under the user's account in the `serato_libraries` and `serato_tracks` tables
- File paths are stored solely to enable `.crate` file export back to Serato — they are never used to access files remotely
- Users can delete their library at any time ("Clear" button in Library)

### 2. Generated Setlists
- When a user generates a setlist, the following is stored in Supabase:
  - Setlist name
  - Genre, crowd context, duration, lineup slot, energy arc settings
  - The full list of AI-selected tracks (artist, title, BPM, key, energy level, transition notes)
  - Creation timestamp
- Setlists are **private by default** (`is_public = false`)
- A public share URL feature is planned but not yet live

### 3. Wishlist Tracks (planned — not yet implemented)
- Future feature: tracks saved from Spotify will be stored as wishlist items
- Would include: artist, title, Spotify track ID, enrichment metadata

### 4. Gig History (planned — not yet implemented)
- Future feature: logs of which setlists were played at which gigs

---

## Data SetDrop Does NOT Collect

- SetDrop does **not** collect payment information (no transactions)
- SetDrop does **not** access or store audio files — only metadata
- SetDrop does **not** use analytics or tracking cookies
- SetDrop does **not** sell or share user data with third parties
- SetDrop does **not** collect location data

---

## Third-Party Services

### Supabase
- **Role:** Database and authentication
- **Data stored:** All user account data, library metadata, setlists
- **Location:** AWS us-east-1
- **Privacy policy:** https://supabase.com/privacy

### Vercel
- **Role:** Hosting and serverless functions
- **Data stored:** Server logs (request metadata, IP addresses) — standard web server logs, retained per Vercel's policy
- **Privacy policy:** https://vercel.com/legal/privacy-policy

### Anthropic (Claude API)
- **Role:** AI setlist generation (5-agent pipeline)
- **Data sent:** The user's library track list (artist, title, BPM, key, genre) + gig parameters. No personal identifying information is sent.
- **Data retention:** Per Anthropic's API data handling policy — API inputs/outputs are not used to train models by default
- **Privacy policy:** https://www.anthropic.com/privacy

### Spotify Web API (planned — OAuth not yet live)
- **Role:** Future feature — users will connect Spotify to save wishlist tracks
- **Data requested:** Read access to saved tracks / liked songs (scope: `user-library-read`)
- **Data stored by SetDrop:** Track title and artist only — no audio features, no listening history
- **OAuth tokens:** Stored in Supabase, encrypted at rest
- **Users can revoke access** from their Spotify account settings at any time
- **Spotify's privacy policy:** https://www.spotify.com/legal/privacy-policy/

---

## Row-Level Security (RLS)

All database tables have Row-Level Security policies enforced at the database level:
- Users can only read, write, and delete their **own** data
- No user can access another user's library, setlists, or account details
- Public setlists (when the share feature is enabled) will be readable by anyone but writable only by the owner

---

## Data Retention & Deletion

- Users can delete their Serato library at any time (Library → Clear)
- Full account deletion is not yet implemented in the UI — users can contact kelcwu@gmail.com to request complete data deletion
- On deletion request: all rows in `users`, `serato_libraries`, `serato_tracks`, `setlists`, `setlist_tracks`, `wishlist_tracks`, and `gig_history` associated with the user will be permanently deleted

---

## Cookies

SetDrop uses **one session cookie** set by Supabase Auth to maintain login state:
- Name: Supabase session cookie (prefixed with `sb-`)
- Type: HTTP-only, Secure, SameSite
- Purpose: Authentication only
- Expires: When the user signs out, or after the session token expires (~1 hour, auto-refreshed on activity)

No advertising cookies. No analytics cookies. No third-party tracking.

---

## Children's Privacy

SetDrop is not directed at children under 13. The app does not knowingly collect personal information from children under 13.

---

## Questions to Resolve Before Publishing

1. **Which API review requires the privacy policy URL?**
   - If **Spotify OAuth** extended quota: Spotify requires a publicly accessible privacy policy URL at `https://setdrop-phi.vercel.app/privacy` (or similar) before approving apps beyond the 25-user development quota.
   - If **Instagram Graph API**: confirm whether Instagram integration is planned and what data would be accessed.

2. **Public-facing URL for the privacy policy:** Does the app have a `/privacy` route? (Not yet — needs to be created as a static page.)

3. **Business entity:** Is SetDrop operated as an individual (Kel Wu) or a business entity?

4. **Jurisdiction:** Primary user base determines which regulations apply (GDPR for EU, CCPA for California, etc.).

---

## Prompt for Claude Chat

> Using the context document above, write a privacy policy for SetDrop. The policy should be:
> - Written in plain English (not legalese)
> - Appropriate for a small indie web app / side project
> - Cover: what data is collected, why, how it's stored, third-party services, user rights, and contact information
> - Include a section for the planned Spotify OAuth integration, clearly marked as "coming soon"
> - Be suitable to publish at a public URL for Spotify API extended quota review
> - Operator name: Kel Wu, contact: kelcwu@gmail.com
