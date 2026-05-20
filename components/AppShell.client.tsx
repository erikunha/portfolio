'use client';

// components/AppShell.client.tsx
// Client boundary for all layout chrome: MatrixRain, CRT overlays, responsive
// navigation bars, Dock, and ToTopButton. Everything else (sections) is passed
// as RSC children and rendered server-side — their code never ships to the client.

import '@/lib/error-bridge.client';
import dynamic from 'next/dynamic';
import { type ReactNode, useEffect } from 'react';
import { useBreakpoint } from '@/lib/use-breakpoint.client';
import { ErrorBoundary } from './ErrorBoundary.client';
import { CRTOverlay } from './responsive/CRTOverlay.client';
import { DesktopTopbar } from './responsive/DesktopTopbar.client';
import { Dock } from './responsive/Dock.client';
import { MatrixRain } from './responsive/MatrixRain.client';
import { MobileTitleBar } from './responsive/MobileTitleBar.client';
import { StatusBar } from './responsive/StatusBar.client';

const ToTopButton = dynamic(
  () => import('./client/ToTopButton').then((m) => ({ default: m.ToTopButton })),
  { ssr: false },
);

export function AppShell({ children }: { children: ReactNode }) {
  const { isMobile } = useBreakpoint();

  // Single delegated listener for Dock's 'module:open' event. Finds the target
  // section by id and, if it's a native <details>, flips the open attribute.
  // Replaces 18 individual listeners that the old client Module set up.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      const target = document.getElementById(detail.id);
      if (target instanceof HTMLDetailsElement) target.open = true;
    };
    window.addEventListener('module:open', handler);
    return () => window.removeEventListener('module:open', handler);
  }, []);

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <ErrorBoundary>
        <MatrixRain
          fontSize={isMobile ? 14 : 16}
          speed={isMobile ? 0.6 : 0.7}
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            opacity: isMobile ? 0.22 : 0.28,
          }}
        />
      </ErrorBoundary>
      <ErrorBoundary>
        <CRTOverlay />
      </ErrorBoundary>
      {/* Chrome is rendered in BOTH variants and CSS-toggled by viewport (see
       * `.chrome--mobile` / `.chrome--desktop` in `app/css/_responsive.css`).
       * Rationale: `app/page.tsx` is `force-static` (audit PR 1 Theme 3) and
       * its HTML is baked at build time without UA context, so any JS-driven
       * variant swap on hydration causes CLS. The two-variant CSS-toggle
       * costs ~30-50 extra DOM nodes (acknowledged in DECISIONS.md PR 6 of
       * audit roadmap) but preserves both the TTFB win (static page) AND the
       * CLS < 0.05 budget. */}
      <div className="chrome--desktop">
        <DesktopTopbar />
      </div>
      <div className="chrome--mobile">
        <StatusBar />
        <MobileTitleBar />
      </div>
      {children}
      <div className="chrome--mobile">
        <Dock />
      </div>
      <ToTopButton />
    </>
  );
}
