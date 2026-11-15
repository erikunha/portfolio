import { LINKS_INTL_LOCALE } from '@/content/links.constants';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';

const COMPACT_FRACTION_DIGITS = 1;

const compactFormat = (locale: SiteLocale) =>
  new Intl.NumberFormat(LINKS_INTL_LOCALE[locale], {
    notation: 'compact',
    maximumFractionDigits: COMPACT_FRACTION_DIGITS,
  });

const COMPACT: Record<SiteLocale, Intl.NumberFormat> = {
  [SITE_LOCALE.pt]: compactFormat(SITE_LOCALE.pt),
  [SITE_LOCALE.en]: compactFormat(SITE_LOCALE.en),
};

export function formatCompact(value: number, locale: SiteLocale): string {
  return COMPACT[locale].format(value);
}
