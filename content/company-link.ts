import { CompanyLinkCopySchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

export const companyLinkCopy: Record<SiteLocale, { disclosure: string }> = {
  [SITE_LOCALE.en]: CompanyLinkCopySchema.parse({ disclosure: '(opens in a new tab)' }),
  [SITE_LOCALE.pt]: CompanyLinkCopySchema.parse({ disclosure: '(abre em uma nova guia)' }),
};
