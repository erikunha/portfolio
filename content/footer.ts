import { FooterContentSchema } from './schemas';
import { localizedPath, SITE_LOCALE, type SiteLocale } from './site-locale';
import { social } from './social';
import { EXTERNAL_LINK_GLYPH } from './terminal-chrome';

const HOME_HREF = '#main-content';
const HOME_SECTION_ID = 'bio';

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
    treeLabel: pt ? 'Mapa do site' : 'Site map',
    groups: [
      {
        directory: './whoami/',
        links: [
          { label: pt ? 'Início' : 'Home', href: HOME_HREF },
          { label: pt ? 'Sobre' : 'About', href: '#sec-readme' },
        ],
      },
      {
        directory: './work/',
        links: [
          { label: pt ? 'Projetos' : 'Projects', href: '#sec-projects' },
          { label: pt ? 'Carreira' : 'Career', href: '#sec-git-log' },
        ],
      },
      {
        directory: './measured/',
        links: [
          { label: pt ? 'Shell interativo' : 'Interactive shell', href: '#sec-shell' },
          { label: pt ? 'Medições' : 'Measured', href: '#sec-live-metrics' },
        ],
      },
      {
        directory: './off_hours/',
        links: [
          { label: pt ? 'Opiniões' : 'Opinions', href: '#sec-hottest-takes' },
          { label: pt ? 'Rig de guitarra' : 'Guitar rig', href: '#sec-guitar' },
          { label: pt ? 'Mixer DAW' : 'DAW mixer', href: '#sec-daw-mixer' },
        ],
      },
      {
        directory: './contact/',
        links: [{ label: pt ? 'Contato' : 'Contact', href: '#sec-contact' }],
      },
      {
        directory: './pages/',
        links: [
          { label: pt ? 'RESUMO_30S' : '30S_SUMMARY', href: localizedPath(locale, '/summary') },
          { label: 'DESIGN_SYSTEM', href: '/design-system' },
          { label: 'LINK_IN_BIO', href: '/links' },
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
      announcement: pt
        ? 'Sessão reiniciada. De volta ao topo; sua sessão está preservada.'
        : 'Session rebooted. Back at the top; your session is preserved.',
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

const SECTION_HREF_PREFIX = '#';

export const footerSectionIds = footerContent[SITE_LOCALE.en].groups.flatMap((group) =>
  group.links
    .filter((link) => link.href.startsWith(SECTION_HREF_PREFIX))
    .map((link) =>
      link.href === HOME_HREF ? HOME_SECTION_ID : link.href.slice(SECTION_HREF_PREFIX.length),
    ),
);
