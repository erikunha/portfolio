import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { BrandLink } from '@/components/BrandLink';
import { PageMain } from '@/components/PageMain';
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
import type { SiteLocale } from '@/content/site-locale';
import { cn } from '@/lib/cn';

const MAIN_CLASS = 'page-container page-main';

export function ReadingShell({
  locale,
  wide = false,
  children,
}: {
  locale: SiteLocale;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <AppShell
      brand={<BrandLink locale={locale} />}
      chrome={siteNavChrome(locale)}
      locale={locale}
      skipLabel={NAVIGATION[locale].copy.skipLabel}
    >
      <div className="reading-view">
        <PageMain className={MAIN_CLASS}>
          <div className={cn('reading-doc', wide && 'reading-doc--wide')}>{children}</div>
        </PageMain>
      </div>
    </AppShell>
  );
}
