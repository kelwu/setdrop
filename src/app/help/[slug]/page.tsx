import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { HELP_GUIDES, getGuide } from '@/lib/setdrop/help-guides';
import { S, HelpTopBar, StepImage } from '../help-ui';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return HELP_GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: `Help — ${BRAND.name}` };
  const title = `${guide.title.charAt(0) + guide.title.slice(1).toLowerCase()} — ${BRAND.name} Help`;
  return {
    title,
    description: guide.summary,
    openGraph: { title, description: guide.summary, siteName: BRAND.name },
  };
}

export default async function HelpGuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const others = HELP_GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <div style={{ background: S.bg, minHeight: '100vh', color: S.text }}>
      <HelpTopBar back="/help" backLabel="← All guides" />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 40px 120px' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontFamily: S.mono, fontSize: 12, color: S.textMuted,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
          }}>
            {guide.eyebrow} · {guide.minutes} min
          </div>
          <h1 style={{
            fontFamily: S.display, fontSize: 'clamp(40px,6vw,68px)',
            letterSpacing: 3, margin: '0 0 16px', lineHeight: 0.95, color: S.text,
          }}>
            {guide.title}
          </h1>
          <p style={{ fontFamily: S.body, fontSize: 15, color: S.textSec, lineHeight: 1.6, margin: 0 }}>
            {guide.summary}
          </p>
        </div>

        {guide.sections.map((section, si) => (
          <div key={si} style={{ marginBottom: 8 }}>
            {section.title && (
              <div style={{ marginTop: si === 0 ? 0 : 44, marginBottom: 20 }}>
                <div style={{ height: 1, background: S.border, marginBottom: 20 }} />
                <div style={{
                  fontFamily: S.mono, fontSize: 13, letterSpacing: 2,
                  textTransform: 'uppercase', color: S.accent, marginBottom: section.intro ? 8 : 0,
                }}>
                  {section.title}
                </div>
                {section.intro && (
                  <p style={{ fontFamily: S.body, fontSize: 14, color: S.textSec, lineHeight: 1.6, margin: 0 }}>
                    {section.intro}
                  </p>
                )}
              </div>
            )}

            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {section.steps.map((step, idx) => (
                <li key={idx} style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: S.surface3, border: `1px solid ${S.borderMid}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: S.mono, fontSize: 13, color: S.accent, marginTop: 2,
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: S.mono, fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 8, letterSpacing: 0.3 }}>
                      {step.heading}
                    </div>
                    {step.body.split('\n\n').map((para, pi) => (
                      <p key={pi} style={{ fontFamily: S.body, fontSize: 14, color: S.textSec, lineHeight: 1.65, margin: pi === 0 ? '0 0 10px' : '0 0 10px' }}>
                        {para}
                      </p>
                    ))}
                    {step.image && <StepImage image={step.image} />}
                    {step.note && (
                      <div style={{
                        marginTop: 12, padding: '10px 14px', borderRadius: 6,
                        background: S.accentDim, border: `1px solid ${S.accent}33`,
                        fontFamily: S.mono, fontSize: 12, color: S.textSec, lineHeight: 1.6,
                      }}>
                        {step.note}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}

        {/* Cross-links */}
        <div style={{ height: 1, background: S.border, margin: '32px 0 20px' }} />
        <div style={{ fontFamily: S.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: S.textMuted, marginBottom: 12 }}>
          Next
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {others.map((g) => (
            <a key={g.slug} href={`/help/${g.slug}`} style={{
              fontFamily: S.mono, fontSize: 13, color: S.accent, textDecoration: 'none',
              border: `1px solid ${S.accent}44`, borderRadius: 6, padding: '8px 14px',
            }}>
              {g.title.charAt(0) + g.title.slice(1).toLowerCase()} →
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
