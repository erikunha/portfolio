'use client';

import '@/lib/error-bridge.client';
import { type ReactNode, useEffect } from 'react';
import { useBreakpoint } from '@/lib/use-breakpoint.client';
import { ToTopButton } from '../client/ToTopButton';
import { ErrorBoundary } from '../ErrorBoundary';
import { CRTOverlay } from '../responsive/CRTOverlay';
import { DesktopTopbar } from '../responsive/DesktopTopbar';
import { Dock } from '../responsive/Dock';
import { MatrixRain } from '../responsive/MatrixRain';
import { MobileTitleBar } from '../responsive/MobileTitleBar';
import { StatusBar } from '../responsive/StatusBar';

export function AppShell({ children }: { children: ReactNode }) {
  const { isMobile } = useBreakpoint();

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
      <div className="desktop-only">
        <DesktopTopbar />
      </div>
      <div className="mobile-only">
        <StatusBar />
        <MobileTitleBar />
      </div>
      {children}
      <div className="mobile-only">
        <Dock />
      </div>
      <ToTopButton />
    </>
  );
}
