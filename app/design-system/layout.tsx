import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { BrandLink } from '@/components/BrandLink';
import { siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';
import { DS_NAV_ID, DS_SKIP_NAV_LABEL } from './_components/ds-nav';
import { DsDrawerNav, DsNavNoScript, PagerNav, Sidebar } from './_components/Sidebar.client';

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      brand={<BrandLink locale={SITE_LOCALE.en} />}
      drawerExtra={<DsDrawerNav />}
      chrome={siteNavChrome(SITE_LOCALE.en)}
      locale={SITE_LOCALE.en}
      skipLabel="Skip to main content"
    >
      <a href={`#${DS_NAV_ID}`} className="skip-to-content ds-skip-nav">
        {DS_SKIP_NAV_LABEL}
      </a>
      <div className="page-container page-main ds-layout">
        <main id="main-content" tabIndex={-1} className="ds-main ds-prose">
          {children}
          <PagerNav />
        </main>
        <Sidebar />
        <DsNavNoScript />
      </div>
    </AppShell>
  );
}
