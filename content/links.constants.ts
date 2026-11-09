import { SITE_HTML_LANG, SITE_LOCALE, type SiteLocale } from './site-locale';

export const LINKS_LOCALE = SITE_LOCALE;

export type LinksLocale = SiteLocale;

export const LINKS_PATH = {
  [LINKS_LOCALE.pt]: '/links',
  [LINKS_LOCALE.en]: '/links/en',
} as const satisfies Record<LinksLocale, string>;

export const LINKS_INTL_LOCALE = SITE_HTML_LANG;

export const PILL_ICON = {
  portfolio: 'portfolio',
  github: 'github',
  linkedin: 'linkedin',
  instagram: 'instagram',
  tiktok: 'tiktok',
  email: 'email',
} as const;

export type PillIcon = (typeof PILL_ICON)[keyof typeof PILL_ICON];

export const UTM_SOURCE = 'bio';
export const UTM_SOURCE_PARAM = 'utm_source';
export const UTM_CONTENT_PARAM = 'utm_content';
