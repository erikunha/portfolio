import type { SiteLocale } from './site-locale';

export const SECTION_ICONS = {
  home: 'home',
  about: 'readme',
  projects: 'projects',
  career: 'git-log',
  shell: 'shell',
  measured: 'live-perf',
  opinions: 'hottest-takes',
  guitar: 'guitar',
  contact: 'contact',
} as const;

export const SECTION_NAV = [
  { id: 'bio', label: { en: 'Home', pt: 'Início' }, order: 1 },
  { id: 'sec-readme', label: { en: 'About', pt: 'Sobre' }, order: 2 },
  { id: 'sec-projects', label: { en: 'Projects', pt: 'Projetos' }, order: 3 },
  { id: 'sec-git-log', label: { en: 'Career', pt: 'Carreira' }, order: 4 },
  { id: 'sec-shell', label: { en: 'Interactive shell', pt: 'Shell interativo' }, order: 5 },
  { id: 'sec-live-metrics', label: { en: 'Measured', pt: 'Medições' }, order: 6 },
  { id: 'sec-hottest-takes', label: { en: 'Opinions', pt: 'Opiniões' }, order: 7 },
  { id: 'sec-guitar', label: { en: 'Guitar and mixer', pt: 'Guitarra e mixer' }, order: 8 },
  { id: 'sec-contact', label: { en: 'Contact', pt: 'Contato' }, order: 9 },
] as const;

export const SECTION_REGISTRY = [
  {
    ...SECTION_NAV[0],
    srLabel: { en: 'Home', pt: 'Início' },
    aliases: ['home', 'bio', 'hero', 'whoami'],
    icon: SECTION_ICONS.home,
  },
  {
    ...SECTION_NAV[1],
    srLabel: { en: 'About', pt: 'Sobre' },
    aliases: ['about', 'readme', 'sec-about', 'principles', 'stack', 'now', 'sobre'],
    icon: SECTION_ICONS.about,
  },
  {
    ...SECTION_NAV[2],
    srLabel: { en: 'Projects', pt: 'Projetos' },
    aliases: ['projects', 'work', 'portfolio', 'receipts', 'projetos', 'trabalho'],
    icon: SECTION_ICONS.projects,
  },
  {
    ...SECTION_NAV[3],
    srLabel: { en: 'Career history', pt: 'Histórico profissional' },
    aliases: [
      'career',
      'experience',
      'git log',
      'education',
      'certifications',
      'community',
      'carreira',
    ],
    icon: SECTION_ICONS.career,
  },
  {
    ...SECTION_NAV[4],
    srLabel: { en: 'Interactive shell', pt: 'Shell interativo' },
    aliases: ['interactive shell', 'shell', 'terminal', 'ask'],
    icon: SECTION_ICONS.shell,
  },
  {
    ...SECTION_NAV[5],
    srLabel: { en: 'Measured', pt: 'Medições' },
    aliases: [
      'measured',
      'sec-live-perf',
      'performance',
      'metrics',
      'lighthouse',
      'evals',
      'medicoes',
    ],
    icon: SECTION_ICONS.measured,
  },
  {
    ...SECTION_NAV[6],
    srLabel: { en: 'Opinions', pt: 'Opiniões' },
    aliases: ['opinions', 'hottest takes', 'takes', 'unknowns', 'opinioes'],
    icon: SECTION_ICONS.opinions,
  },
  {
    ...SECTION_NAV[7],
    srLabel: { en: 'Guitar and mixer', pt: 'Guitarra e mixer' },
    aliases: [
      'guitar and mixer',
      'guitar',
      'guitar rig',
      'music',
      'guitarra',
      'mixer',
      'daw',
      'mix',
      'daw mixer',
    ],
    icon: SECTION_ICONS.guitar,
  },
  {
    ...SECTION_NAV[8],
    srLabel: { en: 'Contact', pt: 'Contato' },
    aliases: ['contact', 'email', 'message', 'contato'],
    icon: SECTION_ICONS.contact,
  },
] as const;

export type SectionRegistryEntry = (typeof SECTION_REGISTRY)[number];
export type SectionId = SectionRegistryEntry['id'];
export type LocalizedLabel = Record<SiteLocale, string>;

export function getSectionById(id: string): SectionRegistryEntry | undefined {
  return SECTION_REGISTRY.find((section) => section.id === id);
}

export function getSectionByAlias(alias: string): SectionRegistryEntry | undefined {
  const normalizedAlias = alias.trim().toLowerCase();
  return SECTION_REGISTRY.find((section) =>
    section.aliases.some((candidate) => candidate === normalizedAlias),
  );
}

export const localizedSectionLabel = (locale: SiteLocale, id: SectionId): string =>
  SECTION_NAV.find((section) => section.id === id)?.label[locale] ?? id;
