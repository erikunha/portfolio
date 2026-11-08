import type { Brand } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

export const SHELL_USER = 'erik@portfolio';

export const brandByLocale: Record<SiteLocale, Brand> = {
  [SITE_LOCALE.en]: { homeHref: '/', accessibleName: 'erikunha.dev, home' },
  [SITE_LOCALE.pt]: { homeHref: '/', accessibleName: 'erikunha.dev, início' },
};
