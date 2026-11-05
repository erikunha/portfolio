import type { ErrorsClientContent } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const errorsClientContentFor = (locale: SiteLocale): ErrorsClientContent => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    chrome: {
      navLabel: pt ? 'Navegação do site' : 'Site navigation',
      skipLabel: pt ? 'Pular para o conteúdo' : 'Skip to main content',
      nav: [
        { label: pt ? 'PROJETOS' : 'WORK', href: pt ? '/pt#sec-projects' : '/#sec-projects' },
        { label: pt ? 'CARREIRA' : 'CAREER', href: pt ? '/pt#sec-git-log' : '/#sec-git-log' },
        { label: pt ? 'CONTATO' : 'CONTACT', href: pt ? '/pt#sec-contact' : '/#sec-contact' },
        { label: 'LINKS', href: '/links' },
        { label: 'DESIGN_SYSTEM', href: '/design-system' },
      ],
    },
    serverError: {
      code: '500',
      message: pt
        ? 'Algo quebrou do nosso lado. Tente de novo em um minuto.'
        : 'Something broke on our side. Try again in a minute.',
      retryLabel: pt ? 'Tentar novamente' : 'Try again',
      home: { label: pt ? 'Ir para o início' : 'Go home', href: pt ? '/pt' : '/' },
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
