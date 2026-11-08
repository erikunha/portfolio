import { copyFeedback } from './copy-button';
import { MAIN_CONTENT_ID } from './landmarks';
import { LINKS_PATH } from './links.constants';
import { FooterContentSchema } from './schemas';
import { localizedSectionLabel, SECTION_ID, type SectionId } from './section-registry';
import { localizedPath, SITE_LOCALE, type SiteLocale } from './site-locale';
import { social } from './social';
import { EXTERNAL_LINK_GLYPH } from './terminal-chrome';

const HOME_HREF = `#${MAIN_CONTENT_ID}`;
const SECTION_HREF_PREFIX = '#';

const sectionLink = (locale: SiteLocale, id: SectionId, href = `${SECTION_HREF_PREFIX}${id}`) => ({
  label: localizedSectionLabel(locale, id),
  href,
});

const footerContentFor = (locale: SiteLocale) => {
  const pt = locale === SITE_LOCALE.pt;
  return FooterContentSchema.parse({
    shutdownTitle: pt ? '[DESLIGAMENTO DO SISTEMA INICIADO]' : '[SYSTEM SHUTDOWN INITIATED]',
    prompt: 'erik@portfolio:~$',
    shutdownCommand: 'shutdown -h now',
    sessionTitle: pt ? 'RELATÓRIO_DE_SESSÃO' : 'SESSION_REPORT',
    sessionLabels: {
      user: pt ? 'usuário' : 'user',
      uptime: pt ? 'tempo de sessão' : 'uptime',
      depth: pt ? 'profundidade do scroll' : 'scroll depth',
      seen: pt ? 'seções vistas' : 'sections seen',
      commands: pt ? 'comandos executados' : 'commands run',
    },
    user: 'erik@portfolio',
    netstatTitle: 'NETSTAT -AN',
    externalGlyph: EXTERNAL_LINK_GLYPH,
    connectionLabels: {
      protocol: 'Proto',
      state: pt ? 'Estado' : 'State',
      endpoint: pt ? 'Destino' : 'Endpoint',
    },
    connections: [
      {
        protocol: 'tcp',
        state: 'ESTABLISHED',
        href: social.github,
        label: social.githubLabel,
        external: true,
      },
      {
        protocol: 'tcp',
        state: 'LISTEN',
        href: social.linkedin,
        label: social.linkedinLabel,
        external: true,
      },
      {
        protocol: 'tcp',
        state: 'ESTABLISHED',
        href: social.site,
        label: social.siteLabel,
        external: true,
      },
      {
        protocol: 'tcp',
        state: 'ESTABLISHED',
        href: '/design-system',
        label: '~/design_system',
        external: false,
      },
    ],
    treeTitle: 'LS -R ~/',
    treeOpenDirectory: './work/',
    treeLabel: pt ? 'Mapa do site' : 'Site map',
    fileCount: { one: pt ? 'arquivo' : 'file', other: pt ? 'arquivos' : 'files' },
    groups: [
      {
        directory: './whoami/',
        links: [
          sectionLink(locale, SECTION_ID.home, HOME_HREF),
          sectionLink(locale, SECTION_ID.about),
        ],
      },
      {
        directory: './work/',
        links: [sectionLink(locale, SECTION_ID.projects), sectionLink(locale, SECTION_ID.career)],
      },
      {
        directory: './measured/',
        links: [sectionLink(locale, SECTION_ID.shell), sectionLink(locale, SECTION_ID.measured)],
      },
      {
        directory: './off_hours/',
        links: [sectionLink(locale, SECTION_ID.opinions), sectionLink(locale, SECTION_ID.guitar)],
      },
      {
        directory: './contact/',
        links: [sectionLink(locale, SECTION_ID.contact)],
      },
      {
        directory: './pages/',
        links: [
          { label: pt ? 'RESUMO_30S' : '30S_SUMMARY', href: localizedPath(locale, '/summary') },
          { label: 'DESIGN_SYSTEM', href: '/design-system' },
          { label: 'LINK_IN_BIO', href: LINKS_PATH[locale] },
          { label: pt ? 'VER_CV' : 'VIEW_CV', href: localizedPath(locale, '/cv') },
        ],
      },
    ],
    halted: pt ? '[SISTEMA ENCERRADO]' : '[SYSTEM HALTED]',
    haltedAt: pt ? 'ENCERRADO ÀS' : 'HALTED AT',
    reboot: {
      label: pt ? 'pressione R para reiniciar, voltar ao topo' : 'press R to reboot, back to top',
      before: pt ? 'pressione' : 'press',
      key: 'R',
      after: pt ? 'para reiniciar' : 'to reboot',
      touch: pt ? 'reiniciar, voltar ao topo' : 'reboot, back to top',
      announcement: pt
        ? 'Sessão reiniciada. De volta ao topo; sua sessão está preservada.'
        : 'Session rebooted. Back at the top; your session is preserved.',
    },
    receipt: {
      label: pt ? 'última requisição' : 'last request',
      feedback: copyFeedback[locale],
    },
    copyright: pt
      ? '© 2026 erik cunha · esta sessão termina aqui · o trabalho não.'
      : "© 2026 erik cunha · this session ends here · the work doesn't.",
  });
};

export const footerContent: Record<SiteLocale, ReturnType<typeof footerContentFor>> = {
  [SITE_LOCALE.en]: footerContentFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: footerContentFor(SITE_LOCALE.pt),
};

export const footerSectionIds = footerContent[SITE_LOCALE.en].groups.flatMap((group) =>
  group.links
    .filter((link) => link.href.startsWith(SECTION_HREF_PREFIX))
    .map((link) =>
      link.href === HOME_HREF ? SECTION_ID.home : link.href.slice(SECTION_HREF_PREFIX.length),
    ),
);
