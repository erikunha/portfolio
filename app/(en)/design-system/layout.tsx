import type { ReactNode } from 'react';
import { PageMain } from '@/components/PageMain';
import { SiteShell } from '@/components/SiteShell';
import { SITE_LOCALE } from '@/content/site-locale';
import { DS_NAV_ID, DS_SKIP_NAV_LABEL } from './_components/ds-nav';
import { DsDrawerNav, DsNavNoScript, PagerNav, Sidebar } from './_components/Sidebar.client';

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return (
    <SiteShell locale={SITE_LOCALE.en} drawerExtra={<DsDrawerNav />}>
      <a href={`#${DS_NAV_ID}`} className="skip-to-content ds-skip-nav">
        {DS_SKIP_NAV_LABEL}
      </a>
      <div className="page-container page-main ds-layout">
        <Sidebar />
        <PageMain className="ds-main ds-prose">
          {children}
          <PagerNav />
        </PageMain>
        <DsNavNoScript />
      </div>
    </SiteShell>
  );
}
