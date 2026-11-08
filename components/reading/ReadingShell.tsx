import type { ReactNode } from 'react';
import { PageMain } from '@/components/PageMain';
import { SiteShell } from '@/components/SiteShell';
import type { SiteLocale } from '@/content/site-locale';

const MAIN_CLASS = 'page-container page-main';

export function ReadingShell({
  locale,
  route,
  children,
}: {
  locale: SiteLocale;
  route: string;
  children: ReactNode;
}) {
  return (
    <SiteShell locale={locale} route={route}>
      <div className="reading-view">
        <PageMain className={MAIN_CLASS}>
          <div className="reading-doc">{children}</div>
        </PageMain>
      </div>
    </SiteShell>
  );
}
