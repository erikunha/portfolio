import { SITE_LOCALE, type SiteLocale } from './site-locale';

export const OPENS_IN_NEW_TAB: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: 'opens in a new tab',
  [SITE_LOCALE.pt]: 'abre em uma nova guia',
};

const disclosureFor = (locale: SiteLocale): { disclosure: string } => ({
  disclosure: `(${OPENS_IN_NEW_TAB[locale]})`,
});

export const companyLinkCopy: Record<SiteLocale, { disclosure: string }> = {
  [SITE_LOCALE.en]: disclosureFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: disclosureFor(SITE_LOCALE.pt),
};
