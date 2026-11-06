import { errorsClientContent } from './errors-client';
import type { ErrorsContent } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const errorsContentFor = (locale: SiteLocale): ErrorsContent => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    ...errorsClientContent[locale],
    notFound: {
      metaTitle: '404 · erikunha.dev',
      code: '404',
      panelHeader: pt ? '[ NÃO ENCONTRADO ]' : '[ NOT FOUND ]',
      prompt: '$',
      command: pt ? 'cd /rota' : 'cd /route',
      output: pt
        ? 'bash: /rota: arquivo ou diretório inexistente'
        : 'bash: /route: no such file or directory',
      suggestionsLabel: pt ? 'TENTE ISTO' : 'TRY INSTEAD',
      suggestionsNavLabel: pt ? 'Páginas sugeridas' : 'Suggested pages',
      suggestions: [
        { label: pt ? 'Projetos' : 'Projects', href: pt ? '/pt#sec-projects' : '/#sec-projects' },
        { label: pt ? 'Contato' : 'Contact', href: pt ? '/pt#sec-contact' : '/#sec-contact' },
        { label: 'Links', href: '/links' },
      ],
      home: { label: pt ? 'Ir para o início' : 'Go home', href: pt ? '/pt' : '/' },
    },
    noscript: {
      text: pt
        ? 'Este site funciona melhor com JavaScript. O conteúdo abaixo está completo; o shell e o formulário de contato precisam dele.'
        : 'This site works best with JavaScript. Content below is complete; the shell and the contact form need it.',
      contact: {
        label: pt ? 'Contato' : 'Contact',
        href: pt ? '/pt#sec-contact' : '/#sec-contact',
      },
    },
  };
};

export const errorsContent: Record<SiteLocale, ErrorsContent> = {
  [SITE_LOCALE.en]: errorsContentFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: errorsContentFor(SITE_LOCALE.pt),
};
