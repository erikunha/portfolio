import { contactCopy } from './contact-copy';
import { type ContactContent, ContactContentSchema } from './contact-types';
import { formatLanguages, profile } from './profile';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

export type { ContactContent } from './contact-types';
export { ContactContentSchema };

export const contactContent: Record<SiteLocale, ContactContent> = {
  [SITE_LOCALE.en]: ContactContentSchema.parse(contactCopy[SITE_LOCALE.en]),
  [SITE_LOCALE.pt]: ContactContentSchema.parse(contactCopy[SITE_LOCALE.pt]),
};

export const contactLanguages = formatLanguages(profile.languages);
