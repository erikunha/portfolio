import { localizedPath, type SiteLocale } from './site-locale';

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

export const SECTION_ID = {
  home: 'bio',
  about: 'sec-readme',
  projects: 'sec-projects',
  career: 'sec-git-log',
  shell: 'sec-shell',
  measured: 'sec-live-metrics',
  opinions: 'sec-hottest-takes',
  guitar: 'sec-guitar',
  contact: 'sec-contact',
} as const;

export const SECTION_NAV = [
  { id: SECTION_ID.home, label: { en: 'Home', pt: 'Início' }, order: 1 },
  { id: SECTION_ID.about, label: { en: 'About', pt: 'Sobre' }, order: 2 },
  { id: SECTION_ID.projects, label: { en: 'Projects', pt: 'Projetos' }, order: 3 },
  { id: SECTION_ID.career, label: { en: 'Career', pt: 'Carreira' }, order: 4 },
  { id: SECTION_ID.shell, label: { en: 'Interactive shell', pt: 'Shell interativo' }, order: 5 },
  { id: SECTION_ID.measured, label: { en: 'Measured', pt: 'Medições' }, order: 6 },
  { id: SECTION_ID.opinions, label: { en: 'Opinions', pt: 'Opiniões' }, order: 7 },
  { id: SECTION_ID.guitar, label: { en: 'Guitar and mixer', pt: 'Guitarra e mixer' }, order: 8 },
  { id: SECTION_ID.contact, label: { en: 'Contact', pt: 'Contato' }, order: 9 },
] as const;

export const SECTION_REGISTRY = [
  {
    ...SECTION_NAV[0],
    srLabel: { en: 'Home', pt: 'Início' },
    icon: SECTION_ICONS.home,
  },
  {
    ...SECTION_NAV[1],
    srLabel: { en: 'About', pt: 'Sobre' },
    icon: SECTION_ICONS.about,
  },
  {
    ...SECTION_NAV[2],
    srLabel: { en: 'Projects', pt: 'Projetos' },
    icon: SECTION_ICONS.projects,
  },
  {
    ...SECTION_NAV[3],
    srLabel: { en: 'Career history', pt: 'Histórico profissional' },
    icon: SECTION_ICONS.career,
  },
  {
    ...SECTION_NAV[4],
    srLabel: { en: 'Interactive shell', pt: 'Shell interativo' },
    icon: SECTION_ICONS.shell,
  },
  {
    ...SECTION_NAV[5],
    srLabel: { en: 'Measured', pt: 'Medições' },
    icon: SECTION_ICONS.measured,
  },
  {
    ...SECTION_NAV[6],
    srLabel: { en: 'Opinions', pt: 'Opiniões' },
    icon: SECTION_ICONS.opinions,
  },
  {
    ...SECTION_NAV[7],
    srLabel: { en: 'Guitar and mixer', pt: 'Guitarra e mixer' },
    icon: SECTION_ICONS.guitar,
  },
  {
    ...SECTION_NAV[8],
    srLabel: { en: 'Contact', pt: 'Contato' },
    icon: SECTION_ICONS.contact,
  },
] as const;

export type SectionRegistryEntry = (typeof SECTION_REGISTRY)[number];
export type SectionId = SectionRegistryEntry['id'];
export type LocalizedLabel = Record<SiteLocale, string>;

export const localizedSectionLabel = (locale: SiteLocale, id: SectionId): string =>
  SECTION_NAV.find((section) => section.id === id)?.label[locale] ?? id;

export const sectionPath = (locale: SiteLocale, id: SectionId): string =>
  localizedPath(locale, `/#${id}`);
