import { LINKS_INTL_LOCALE, LINKS_LOCALE, type LinksLocale } from '@/content/links.constants';

const COMPACT_FRACTION_DIGITS = 1;

const compactFormat = (locale: LinksLocale) =>
  new Intl.NumberFormat(LINKS_INTL_LOCALE[locale], {
    notation: 'compact',
    maximumFractionDigits: COMPACT_FRACTION_DIGITS,
  });

const COMPACT: Record<LinksLocale, Intl.NumberFormat> = {
  [LINKS_LOCALE.pt]: compactFormat(LINKS_LOCALE.pt),
  [LINKS_LOCALE.en]: compactFormat(LINKS_LOCALE.en),
};

export function formatCompact(value: number, locale: LinksLocale): string {
  return COMPACT[locale].format(value);
}
