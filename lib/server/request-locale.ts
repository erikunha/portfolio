import { DEFAULT_SITE_LOCALE, SITE_LOCALES, type SiteLocale } from '@/content/site-locale';
import { SITE_LOCALE_HEADER } from '@/lib/stream-protocol';

export function localeFromRequest(req: Request): SiteLocale {
  const header = req.headers.get(SITE_LOCALE_HEADER);
  return SITE_LOCALES.find((locale) => locale === header) ?? DEFAULT_SITE_LOCALE;
}
