import type { ErrorsClientContent } from './schemas';
import { serverErrorContent } from './server-error-detail';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const errorsClientContentFor = (locale: SiteLocale): ErrorsClientContent => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    componentUnavailable: pt ? 'componente indisponível' : 'component unavailable',
    componentExplanation: pt
      ? 'O resto da página segue funcionando. Recarregar costuma resolver.'
      : 'The rest of the page keeps working. Reloading usually fixes it.',
    reloadLabel: pt ? '[ RECARREGAR ]' : '[ RELOAD ]',
    serverError: serverErrorContent[locale],
  };
};

export const errorsClientContent: Record<SiteLocale, ErrorsClientContent> = {
  [SITE_LOCALE.en]: errorsClientContentFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: errorsClientContentFor(SITE_LOCALE.pt),
};
