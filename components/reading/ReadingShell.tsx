import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { BrandLink } from '@/components/BrandLink';
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
import type { SiteLocale } from '@/content/site-locale';
import { cn } from '@/lib/cn';

const MAIN_ID = 'main-content';

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
        <main id={MAIN_ID} tabIndex={-1} className="page-container page-main">
          <div className={cn('reading-doc', wide && 'reading-doc--wide')}>{children}</div>
        </main>
      </div>
    </AppShell>
  );
}
