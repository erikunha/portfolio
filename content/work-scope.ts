import { SITE_LOCALE, type SiteLocale } from './site-locale';

export const WORK_SCOPE_SENTENCE = 'any arrangement: remote worldwide, hybrid or on-site';

export const WORK_SCOPE: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: `open to ${WORK_SCOPE_SENTENCE}`,
  [SITE_LOCALE.pt]: 'aberto a qualquer formato: remoto global, híbrido ou presencial',
};
