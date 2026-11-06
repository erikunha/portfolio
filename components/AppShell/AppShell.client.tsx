'use client';

import '@/lib/error-bridge.client';
import type { ReactNode } from 'react';
import { MAIN_CONTENT_ID } from '@/components/PageMain';
import type { SiteNavChrome } from '@/content/navigation';
import type { SiteLocale } from '@/content/site-locale';
import { OfflineNotice } from '../client/OfflineNotice';
import { ToTopButton } from '../client/ToTopButton';
import { ErrorBoundary } from '../ErrorBoundary';
import { CRTOverlay } from '../responsive/CRTOverlay';
import { DesktopTopbar } from '../responsive/DesktopTopbar';
import { Dock } from '../responsive/Dock';
import { MobileTitleBar } from '../responsive/MobileTitleBar';
import { PositionMeter } from '../responsive/PositionMeter';
import { SectionNavigation, SectionNavigationProvider } from '../responsive/SectionNavigation';
import { StatusBar } from '../responsive/StatusBar';

export function AppShell({
  brand,
  children,
  drawerExtra,
  chrome,
  locale,
  skipLabel,
}: {
  brand: ReactNode;
  children: ReactNode;
  drawerExtra?: ReactNode;
  chrome: SiteNavChrome;
  locale: SiteLocale;
  skipLabel: string;
}) {
  return (
    <>
      <a href={`#${MAIN_CONTENT_ID}`} className="skip-to-content">
        {skipLabel}
      </a>
      <OfflineNotice locale={locale} />
      <SectionNavigationProvider chrome={chrome} locale={locale}>
        <SectionNavigation extra={drawerExtra} />
        <ErrorBoundary locale={locale}>
          <CRTOverlay />
        </ErrorBoundary>
        <div className="desktop-only">
          <DesktopTopbar brand={brand} />
        </div>
        <div className="mobile-only">
          <StatusBar />
          <MobileTitleBar brand={brand} />
        </div>
        <div className="app-content">{children}</div>
        <Dock />
        <PositionMeter />
        <ToTopButton />
      </SectionNavigationProvider>
    </>
  );
}
