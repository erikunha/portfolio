import { NOT_FOUND_PATH_TOKEN } from './errors.constants';
import { errorsClientContent } from './errors-client';
import { LINKS_PATH } from './links.constants';
import type { ErrorsContent } from './schemas';
import { localizedSectionLabel, SECTION_ID, sectionPath } from './section-registry';
import { localizedPath, SITE_LOCALE, type SiteLocale } from './site-locale';

const errorsContentFor = (locale: SiteLocale): ErrorsContent => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    ...errorsClientContent[locale],
    notFound: {
      metaTitle: '404 · erikunha.dev',
      code: '404',
      panelHeader: pt ? '[ NÃO ENCONTRADO ]' : '[ NOT FOUND ]',
      prompt: '$',
      command: `cd ${NOT_FOUND_PATH_TOKEN}`,
      output: pt
        ? `bash: ${NOT_FOUND_PATH_TOKEN}: arquivo ou diretório inexistente`
        : `bash: ${NOT_FOUND_PATH_TOKEN}: no such file or directory`,
      pathFallback: pt ? '/rota' : '/route',
      suggestionsLabel: pt ? 'TENTE ISTO' : 'TRY INSTEAD',
      suggestionsNavLabel: pt ? 'Páginas sugeridas' : 'Suggested pages',
      suggestions: [
        {
          label: localizedSectionLabel(locale, SECTION_ID.projects),
          href: sectionPath(locale, SECTION_ID.projects),
        },
        {
          label: localizedSectionLabel(locale, SECTION_ID.contact),
          href: sectionPath(locale, SECTION_ID.contact),
        },
        { label: 'Links', href: LINKS_PATH[locale] },
      ],
      home: { label: pt ? 'Ir para o início' : 'Go home', href: localizedPath(locale, '/') },
    },
    noscript: {
      text: pt
        ? 'Este site funciona melhor com JavaScript. O conteúdo abaixo está completo; o shell e o formulário de contato precisam dele.'
        : 'This site works best with JavaScript. Content below is complete; the shell and the contact form need it.',
      contact: {
        label: localizedSectionLabel(locale, SECTION_ID.contact),
        href: sectionPath(locale, SECTION_ID.contact),
      },
    },
  };
};

export const errorsContent: Record<SiteLocale, ErrorsContent> = {
  [SITE_LOCALE.en]: errorsContentFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: errorsContentFor(SITE_LOCALE.pt),
};
