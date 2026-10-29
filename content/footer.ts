import { FooterContentSchema } from './schemas';
import { social } from './social';

const HOME_HREF = '#main-content';
const HOME_SECTION_ID = 'bio';

export const footerContent = FooterContentSchema.parse({
  shutdownTitle: '[SYSTEM SHUTDOWN INITIATED]',
  prompt: 'erik@portfolio:~$',
  shutdownCommand: 'shutdown -h now',
  sessionTitle: 'SESSION_REPORT',
  sessionLabels: {
    user: 'user',
    uptime: 'uptime',
    depth: 'scroll depth',
    seen: 'sections seen',
    commands: 'commands run',
  },
  user: 'erik@portfolio',
  netstatTitle: 'NETSTAT -AN',
  copyLabel: 'Copy netstat rows',
  connectionLabels: { protocol: 'Proto', state: 'State', endpoint: 'Endpoint' },
  connections: [
    {
      protocol: 'tcp',
      state: 'ESTABLISHED',
      href: social.github,
      label: 'github.com/erikunha',
      external: true,
    },
    {
      protocol: 'tcp',
      state: 'LISTEN',
      href: social.linkedin,
      label: 'linkedin.com/in/erikunha',
      external: true,
    },
    {
      protocol: 'tcp',
      state: 'ESTABLISHED',
      href: social.site,
      label: 'erikunha.dev',
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
  treeLabel: 'Site map',
  groups: [
    {
      directory: './whoami/',
      links: [
        { label: 'Home', href: HOME_HREF },
        { label: 'About', href: '#sec-readme' },
      ],
    },
    {
      directory: './work/',
      links: [
        { label: 'Projects', href: '#sec-projects' },
        { label: 'Career', href: '#sec-git-log' },
      ],
    },
    {
      directory: './measured/',
      links: [
        { label: 'Interactive shell', href: '#sec-shell' },
        { label: 'Measured', href: '#sec-live-metrics' },
      ],
    },
    {
      directory: './off_hours/',
      links: [
        { label: 'Opinions', href: '#sec-hottest-takes' },
        { label: 'Guitar and mixer', href: '#sec-guitar' },
      ],
    },
    { directory: './contact/', links: [{ label: 'Contact', href: '#sec-contact' }] },
    {
      directory: './pages/',
      links: [
        { label: 'DESIGN_SYSTEM', href: '/design-system' },
        { label: 'LINK_IN_BIO', href: '/links' },
      ],
    },
  ],
  halted: '[SYSTEM HALTED]',
  haltedAt: 'HALTED AT',
  reboot: {
    label: 'press R to reboot, back to top',
    before: 'press',
    key: 'R',
    after: 'to reboot',
    announcement: 'Session rebooted. Back at the top; your session is preserved.',
  },
  copyright: "© 2026 erik cunha · this session ends here · the work doesn't.",
});

const SECTION_HREF_PREFIX = '#';

export const footerSectionIds = footerContent.groups.flatMap((group) =>
  group.links
    .filter((link) => link.href.startsWith(SECTION_HREF_PREFIX))
    .map((link) =>
      link.href === HOME_HREF ? HOME_SECTION_ID : link.href.slice(SECTION_HREF_PREFIX.length),
    ),
);
