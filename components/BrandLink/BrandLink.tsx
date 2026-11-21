import { brandByLocale } from '@/content/brand';
import type { SiteLocale } from '@/content/site-locale';
import { BrandIcon } from '@/design-system/components/BrandIcon';
import { joinClassNames } from '@/lib/join-class-names';

export function BrandLink({ locale, className }: { locale: SiteLocale; className?: string }) {
  const brand = brandByLocale[locale];
  return (
    <a
      className={joinClassNames('brand-link', className)}
      href={brand.homeHref}
      aria-label={brand.accessibleName}
    >
      <BrandIcon />
    </a>
  );
}
