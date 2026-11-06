import { LINKS_PATH } from './links.constants';
import { NAV_VOCABULARY } from './nav';
import type { ErrorsClientContent } from './schemas';
import { SECTION_ID, sectionPath } from './section-registry';
import { localizedPath, SITE_LOCALE, type SiteLocale } from './site-locale';

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
    serverError: {
      code: '500',
      message: pt
        ? 'Algo quebrou do nosso lado. Tente de novo em um minuto.'
        : 'Something broke on our side. Try again in a minute.',
      retryLabel: pt ? 'Tentar novamente' : 'Try again',
      home: { label: pt ? 'Ir para o início' : 'Go home', href: localizedPath(locale, '/') },
      refLabel: 'ref:',
      copyLabel: pt ? 'COPIAR' : 'COPY',
      copyAriaLabel: pt ? 'Copiar id de referência' : 'Copy reference id',
      copiedAnnouncement: pt ? 'Id de referência copiado' : 'Reference id copied',
    },
  };
};

export const errorsClientContent: Record<SiteLocale, ErrorsClientContent> = {
  [SITE_LOCALE.en]: errorsClientContentFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: errorsClientContentFor(SITE_LOCALE.pt),
};
