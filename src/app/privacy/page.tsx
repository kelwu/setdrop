import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — SetDrop',
  description: 'How SetDrop collects, uses, and protects your data.',
};

const S = {
  bg: '#0A0A0A', surface: '#141414', border: 'rgba(255,255,255,0.07)',
  accent: '#F5A623', text: '#F0F0F0', textSec: '#8A8A8A', textMuted: '#4A4A4A',
  mono: 'var(--font-mono), monospace', display: 'var(--font-display), sans-serif',
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: S.display, fontSize: 28, letterSpacing: 2,
      color: S.text, margin: '48px 0 16px', lineHeight: 1 }}>
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: S.mono, fontSize: 13, color: S.textSec,
      lineHeight: 1.8, margin: '0 0 16px' }}>
      {children}
    </p>
  );
}

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ margin: '0 0 16px', paddingLeft: 24 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontFamily: S.mono, fontSize: 13, color: S.textSec,
          lineHeight: 1.8, marginBottom: 6 }}>{item}</li>
      ))}
    </ul>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: S.mono, fontSize: 11, color: S.accent,
      background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)',
      borderRadius: 2, padding: '2px 8px', marginLeft: 8, verticalAlign: 'middle' }}>
      {children}
    </span>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ background: S.bg, minHeight: '100vh', color: S.text }}>
      {/* Nav */}
      <div style={{ padding: '20px 40px', borderBottom: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontFamily: S.display, fontSize: 22, letterSpacing: 3,
          color: S.text, textDecoration: 'none' }}>
          SET<span style={{ color: S.accent }}>DROP</span>
        </a>
        <a href="/" style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted,
          textDecoration: 'none', letterSpacing: 1 }}>← Back to app</a>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 40px 120px' }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: S.mono, fontSize: 9, color: S.textMuted,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
            Last updated: April 28, 2026
          </div>
          <h1 style={{ fontFamily: S.display, fontSize: 'clamp(48px,7vw,80px)',
            letterSpacing: 4, margin: '0 0 16px', lineHeight: .95, color: S.text }}>
            PRIVACY POLICY
          </h1>
          <P>
            SetDrop is a tool for DJs. We take your data seriously and keep this policy short and plain.
            If you have questions, email <a href="mailto:kelcwu@gmail.com"
              style={{ color: S.accent, textDecoration: 'none' }}>kelcwu@gmail.com</a>.
          </P>
        </div>

        <div style={{ height: 1, background: S.border, marginBottom: 8 }} />

        {/* 1 */}
        <H2>1. What SetDrop Is</H2>
        <P>
          SetDrop is a web app that helps DJs plan setlists. It imports your Serato library,
          uses AI (Claude by Anthropic) to generate a sequenced set based on your gig context,
          and exports the result back to Serato as a <code style={{ color: S.accent }}>.crate</code> file.
        </P>
        <P>
          SetDrop is operated by Kel Wu, an individual developer. Contact:{' '}
          <a href="mailto:kelcwu@gmail.com" style={{ color: S.accent, textDecoration: 'none' }}>
            kelcwu@gmail.com
          </a>
        </P>

        {/* 2 */}
        <H2>2. What Data We Collect</H2>

        <p style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted,
          letterSpacing: 1.5, textTransform: 'uppercase', margin: '24px 0 10px' }}>
          Account
        </p>
        <UL items={[
          'Email address (used to log in and contact you)',
          'A Supabase-generated user ID (UUID)',
          'Account creation timestamp',
          'No passwords are stored by SetDrop — Supabase Auth handles credential storage using bcrypt hashing',
        ]} />

        <p style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted,
          letterSpacing: 1.5, textTransform: 'uppercase', margin: '24px 0 10px' }}>
          Serato Library
        </p>
        <P>
          When you upload your Serato library file, SetDrop extracts and stores per-track metadata:
        </P>
        <UL items={[
          'Artist name',
          'Track title',
          'BPM',
          'Musical key',
          'Genre',
          'File path (the path on your local machine as stored by Serato — used only to generate .crate files for re-import; SetDrop never accesses your files remotely)',
        ]} />
        <P>Audio files are never uploaded. Only the text metadata above is stored.</P>

        <p style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted,
          letterSpacing: 1.5, textTransform: 'uppercase', margin: '24px 0 10px' }}>
          Generated Setlists
        </p>
        <P>When a setlist is generated, we store:</P>
        <UL items={[
          'Setlist name, genre, crowd context, duration, and lineup slot',
          'Energy arc settings',
          'The ordered list of selected tracks with transition notes and AI annotations',
          'Creation timestamp',
        ]} />
        <P>
          Setlists are private by default. You can publish a setlist to get a public share URL —
          see Section 5 for how that works.
        </P>

        <p style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted,
          letterSpacing: 1.5, textTransform: 'uppercase', margin: '24px 0 10px' }}>
          What We Do NOT Collect
        </p>
        <UL items={[
          'Payment information (SetDrop has no paid features)',
          'Audio files or audio content',
          'Location data',
          'Analytics or behavioral tracking data',
          'Advertising identifiers',
        ]} />

        {/* 3 */}
        <H2>3. How We Use Your Data</H2>
        <UL items={[
          'To log you in and keep your session active',
          'To store and retrieve your Serato library across devices',
          'To generate AI setlists using your library and gig parameters',
          'To match setlist tracks to your library for .crate file export',
          'To display your setlist history on your dashboard',
        ]} />
        <P>We do not sell your data. We do not share it with third parties except as described in Section 4.</P>

        {/* 4 */}
        <H2>4. Third-Party Services</H2>

        <p style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted,
          letterSpacing: 1.5, textTransform: 'uppercase', margin: '24px 0 10px' }}>
          Supabase
        </p>
        <P>
          Supabase provides our database and authentication. All user data — accounts, library metadata,
          and setlists — is stored in Supabase on AWS infrastructure in us-east-1. Row-Level Security
          policies ensure each user can only access their own data.{' '}
          <a href="https://supabase.com/privacy" style={{ color: S.accent, textDecoration: 'none' }}>
            Supabase Privacy Policy ↗
          </a>
        </P>

        <p style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted,
          letterSpacing: 1.5, textTransform: 'uppercase', margin: '24px 0 10px' }}>
          Vercel
        </p>
        <P>
          SetDrop is hosted on Vercel. Standard server logs (request metadata, IP addresses) are
          retained per Vercel&apos;s own policy.{' '}
          <a href="https://vercel.com/legal/privacy-policy" style={{ color: S.accent, textDecoration: 'none' }}>
            Vercel Privacy Policy ↗
          </a>
        </P>

        <p style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted,
          letterSpacing: 1.5, textTransform: 'uppercase', margin: '24px 0 10px' }}>
          Anthropic (Claude AI)
        </p>
        <P>
          When you generate a setlist, SetDrop sends your library metadata (artist, title, BPM, key, genre)
          and gig parameters to the Anthropic Claude API. No personally identifying information is included.
          Anthropic does not use API inputs to train its models by default.{' '}
          <a href="https://www.anthropic.com/privacy" style={{ color: S.accent, textDecoration: 'none' }}>
            Anthropic Privacy Policy ↗
          </a>
        </P>

        <p style={{ fontFamily: S.mono, fontSize: 11, color: S.textMuted,
          letterSpacing: 1.5, textTransform: 'uppercase', margin: '24px 0 10px' }}>
          Spotify <Tag>Coming Soon</Tag>
        </p>
        <P>
          A future update will let you connect your Spotify account to save tracks to a wishlist.
          Here is what that integration will look like when it launches:
        </P>
        <UL items={[
          <>
            <strong style={{ color: S.text }}>What we request:</strong> Read-only access to your
            saved tracks / liked songs (OAuth scope: <code style={{ color: S.accent }}>user-library-read</code>)
          </>,
          <>
            <strong style={{ color: S.text }}>What we store:</strong> Track artist and title only —
            no listening history, no audio features, no personal profile data
          </>,
          <>
            <strong style={{ color: S.text }}>OAuth tokens:</strong> Stored in Supabase, encrypted
            at rest. Used only to fetch your saved tracks on your behalf.
          </>,
          <>
            <strong style={{ color: S.text }}>Revoking access:</strong> You can disconnect Spotify
            from your Spotify account settings at any time (
            <a href="https://www.spotify.com/account/apps/" style={{ color: S.accent, textDecoration: 'none' }}>
              spotify.com/account/apps
            </a>)
          </>,
        ]} />
        <P>
          <a href="https://www.spotify.com/legal/privacy-policy/" style={{ color: S.accent, textDecoration: 'none' }}>
            Spotify Privacy Policy ↗
          </a>
        </P>

        {/* 5 */}
        <H2>5. Public Setlists</H2>
        <P>
          Setlists are private by default. If you click &ldquo;Make Public&rdquo; on a setlist, it becomes
          accessible to anyone with the link at <code style={{ color: S.accent }}>setdrop-phi.vercel.app/set/[slug]</code>.
          Public setlists show the track list, energy arc, and metadata — no account information is exposed.
          You cannot currently undo a public setlist through the UI; contact{' '}
          <a href="mailto:kelcwu@gmail.com" style={{ color: S.accent, textDecoration: 'none' }}>
            kelcwu@gmail.com
          </a>{' '}to make one private again.
        </P>

        {/* 6 */}
        <H2>6. Cookies</H2>
        <P>
          SetDrop uses one cookie: the Supabase session cookie (prefixed <code style={{ color: S.accent }}>sb-</code>),
          set when you log in. It is HTTP-only, Secure, and SameSite. It expires when you sign out or
          after the session token expires (~1 hour, auto-refreshed while you&apos;re active).
        </P>
        <P>No advertising cookies. No analytics cookies. No third-party tracking of any kind.</P>

        {/* 7 */}
        <H2>7. Your Rights</H2>
        <UL items={[
          <>
            <strong style={{ color: S.text }}>Access:</strong> Your library and setlists are visible
            in the app at any time.
          </>,
          <>
            <strong style={{ color: S.text }}>Delete library:</strong> Use the &ldquo;Clear&rdquo; button
            in the Library tab to delete all imported tracks at any time.
          </>,
          <>
            <strong style={{ color: S.text }}>Delete account:</strong> Account deletion is not yet
            available in the UI. Email{' '}
            <a href="mailto:kelcwu@gmail.com" style={{ color: S.accent, textDecoration: 'none' }}>
              kelcwu@gmail.com
            </a>{' '}
            and all your data — account, library, and setlists — will be permanently deleted within 7 days.
          </>,
          <>
            <strong style={{ color: S.text }}>Data portability:</strong> Your generated setlists
            can be exported as Serato .crate files. Contact us if you need a full data export.
          </>,
        ]} />

        {/* 8 */}
        <H2>8. Data Security</H2>
        <P>
          All data is stored in Supabase with Row-Level Security — database policies prevent any user
          from reading another user&apos;s data, even if they have valid credentials. Connections are
          encrypted in transit (TLS). Passwords are hashed by Supabase Auth (bcrypt).
        </P>
        <P>
          SetDrop is a small indie project. While we follow reasonable security practices, no system
          is perfectly secure. Do not store sensitive personal information in setlist names or notes.
        </P>

        {/* 9 */}
        <H2>9. Children&apos;s Privacy</H2>
        <P>
          SetDrop is not directed at children under 13. We do not knowingly collect personal information
          from anyone under 13. If you believe a child has provided us with personal data, contact us
          and we will delete it promptly.
        </P>

        {/* 10 */}
        <H2>10. Changes to This Policy</H2>
        <P>
          When we make material changes, we&apos;ll update the &ldquo;Last updated&rdquo; date at the top.
          Continued use of SetDrop after changes means you accept the updated policy.
          For significant changes, we&apos;ll notify users by email if possible.
        </P>

        {/* 11 */}
        <H2>11. Contact</H2>
        <P>
          Questions, deletion requests, or anything else:{' '}
          <a href="mailto:kelcwu@gmail.com" style={{ color: S.accent, textDecoration: 'none' }}>
            kelcwu@gmail.com
          </a>
        </P>

        <div style={{ height: 1, background: S.border, margin: '48px 0 32px' }} />
        <P>
          <span style={{ color: S.textMuted }}>
            SetDrop is operated by Kel Wu · {' '}
            <a href="mailto:kelcwu@gmail.com" style={{ color: S.textMuted, textDecoration: 'none' }}>
              kelcwu@gmail.com
            </a>
          </span>
        </P>
      </div>
    </div>
  );
}
