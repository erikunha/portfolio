import { LINKS_PATH } from './links.constants';
import { NAV_VOCABULARY } from './nav';
import type { ErrorsClientContent } from './schemas';
import { SECTION_ID, sectionPath } from './section-registry';
import { serverErrorContent } from './server-error-detail';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const errorsClientContentFor = (locale: SiteLocale): ErrorsClientContent => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    chrome: {
      navLabel: pt ? 'Navegação do site' : 'Site navigation',
      skipLabel: pt ? 'Pular para o conteúdo' : 'Skip to main content',
      nav: [
        { label: NAV_VOCABULARY[locale].work, href: sectionPath(locale, SECTION_ID.projects) },
        { label: NAV_VOCABULARY[locale].career, href: sectionPath(locale, SECTION_ID.career) },
        { label: NAV_VOCABULARY[locale].contact, href: sectionPath(locale, SECTION_ID.contact) },
        { label: NAV_VOCABULARY[locale].links, href: LINKS_PATH[locale] },
        { label: NAV_VOCABULARY[locale].designSystem, href: '/design-system' },
      ],
    },
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
