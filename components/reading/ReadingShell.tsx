import type { ReactNode } from 'react';
import { PageMain } from '@/components/PageMain';
import { SiteShell } from '@/components/SiteShell';
import type { SiteLocale } from '@/content/site-locale';
import { cn } from '@/lib/cn';

const MAIN_CLASS = 'page-container page-main';

export function ReadingShell({
  locale,
  route,
  wide = false,
  children,
}: {
  locale: SiteLocale;
  route: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <SiteShell locale={locale} route={route}>
      <div className="reading-view">
        <PageMain className={MAIN_CLASS}>
          <div className={cn('reading-doc', wide && 'reading-doc--wide')}>{children}</div>
        </PageMain>
      </div>
    </SiteShell>
  );
}
