'use client';

import '@/lib/error-bridge.client';
import type { ReactNode } from 'react';
import { ToTopButton } from '../client/ToTopButton';
import { ErrorBoundary } from '../ErrorBoundary';
import { CRTOverlay } from '../responsive/CRTOverlay';
import { DesktopTopbar } from '../responsive/DesktopTopbar';
import { Dock } from '../responsive/Dock';
import { MobileTitleBar } from '../responsive/MobileTitleBar';
import { PositionMeter } from '../responsive/PositionMeter';
import { SectionNavigation, SectionNavigationProvider } from '../responsive/SectionNavigation';
import { StatusBar } from '../responsive/StatusBar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <SectionNavigationProvider>
        <SectionNavigation />
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
        <div className="app-content">{children}</div>
        <Dock />
        <PositionMeter />
        <ToTopButton />
      </SectionNavigationProvider>
    </>
  );
}
