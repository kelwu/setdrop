import Link from 'next/link';
import { SD } from '@/lib/setdrop/constants';
import { BRAND } from '@/lib/brand';

// Branded 404 — replaces Next's default bare "This page could not be found."
export default function NotFound() {
  return (
    <div style={{
      background: SD.bg, minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: SD.mono,
      backgroundImage: `
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
      `,
      backgroundSize: '60px 60px',
    }}>
      <div style={{ textAlign: 'center', padding: '0 20px' }}>
        <div style={{ fontFamily: SD.display, fontSize: 32, letterSpacing: 4, color: SD.text, marginBottom: 28 }}>
          {BRAND.logoLeft}<span style={{ color: SD.accent }}>{BRAND.logoRight}</span>
        </div>
        <div style={{ fontFamily: SD.display, fontSize: 72, letterSpacing: 4, color: SD.accent, lineHeight: 1 }}>404</div>
        <div style={{ fontSize: 13, color: SD.textSec, letterSpacing: 1.5, marginTop: 12, textTransform: 'uppercase' }}>
          This page doesn&apos;t exist
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
          <Link href="/" style={{
            fontFamily: SD.mono, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase',
            color: '#000', background: SD.accent, borderRadius: 3, padding: '10px 20px', textDecoration: 'none',
          }}>
            ← Home
          </Link>
          <Link href="/dashboard" style={{
            fontFamily: SD.mono, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase',
            color: SD.text, background: SD.surface2, border: `1px solid ${SD.borderMid}`,
            borderRadius: 3, padding: '10px 20px', textDecoration: 'none',
          }}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
