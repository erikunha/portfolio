import { SITE_LOCALE, type SiteLocale } from './site-locale';

export const READING_PATHS = { cv: '/cv', summary: '/summary' } as const;

export const CV_LINK_LABEL: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: 'VIEW_CV',
  [SITE_LOCALE.pt]: 'VER_CV',
};
