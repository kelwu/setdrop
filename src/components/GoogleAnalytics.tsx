'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Measurement ID is inlined at build time. When unset (e.g. local dev without
// the env var), the component renders nothing and no GA script is loaded.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics 4 for the App Router.
 *
 * The initial page view is sent by the inline init script below. Because the
 * App Router does client-side navigation (no full reload), we send an
 * additional page_view on every pathname change — skipping the very first
 * effect run so the initial load isn't counted twice.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (!GA_ID) return;
    if (isFirstRun.current) {
      isFirstRun.current = false; // initial view already sent by the init script
      return;
    }
    if (typeof window.gtag !== 'function') return;
    window.gtag('config', GA_ID, {
      page_path: pathname + window.location.search,
    });
  }, [pathname]);

  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
