import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { BrandLink } from '@/components/BrandLink';
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
import type { SiteLocale } from '@/content/site-locale';

export function SiteShell({
  locale,
  route,
  drawerExtra,
  children,
}: {
  locale: SiteLocale;
  route?: string | undefined;
  drawerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppShell
      brand={<BrandLink locale={locale} />}
      chrome={siteNavChrome(locale)}
      drawerExtra={drawerExtra}
      locale={locale}
      route={route}
      skipLabel={NAVIGATION[locale].copy.skipLabel}
    >
      {children}
    </AppShell>
  );
}
