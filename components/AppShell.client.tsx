'use client';

// components/AppShell.client.tsx
// Client boundary for all layout chrome: MatrixRain, CRT overlays, responsive
// navigation bars, Dock, and ToTopButton. Everything else (sections) is passed
// as RSC children and rendered server-side — their code never ships to the client.

import { useBreakpoint } from '@/lib/use-breakpoint';
import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary.client';
import { ToTopButton } from './client/ToTopButton';
import { CRTOverlay } from './responsive/CRTOverlay';
import { DesktopTopbar } from './responsive/DesktopTopbar';
import { Dock } from './responsive/Dock';
import { MatrixRain } from './responsive/MatrixRain';
import { MobileTitleBar } from './responsive/MobileTitleBar';
import { StatusBar } from './responsive/StatusBar';

export function AppShell({ children }: { children: ReactNode }) {
  const { isMobile } = useBreakpoint();
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
      {isMobile ? <StatusBar /> : <DesktopTopbar />}
      {isMobile ? <MobileTitleBar /> : null}
      {children}
      {isMobile ? <Dock /> : null}
      <ToTopButton />
    </>
  );
}
