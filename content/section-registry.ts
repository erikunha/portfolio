import { localizedPath, type SiteLocale } from './site-locale';

export const SECTIONS = {
  home: {
    id: 'bio',
    label: { en: 'Home', pt: 'Início' },
    srLabel: { en: 'Home', pt: 'Início' },
    icon: 'home',
  },
  about: {
    id: 'sec-readme',
    label: { en: 'About', pt: 'Sobre' },
    srLabel: { en: 'About', pt: 'Sobre' },
    icon: 'readme',
  },
  projects: {
    id: 'sec-projects',
    label: { en: 'Projects', pt: 'Projetos' },
    srLabel: { en: 'Projects', pt: 'Projetos' },
    icon: 'projects',
  },
  career: {
    id: 'sec-git-log',
    label: { en: 'Career', pt: 'Carreira' },
    srLabel: { en: 'Career history', pt: 'Histórico profissional' },
    icon: 'git-log',
  },
  shell: {
    id: 'sec-shell',
    label: { en: 'Interactive shell', pt: 'Shell interativo' },
    srLabel: { en: 'Interactive shell', pt: 'Shell interativo' },
    icon: 'shell',
  },
  measured: {
    id: 'sec-live-metrics',
    label: { en: 'Measured', pt: 'Medições' },
    srLabel: { en: 'Measured', pt: 'Medições' },
    icon: 'live-perf',
  },
  opinions: {
    id: 'sec-hottest-takes',
    label: { en: 'Opinions', pt: 'Opiniões' },
    srLabel: { en: 'Opinions', pt: 'Opiniões' },
    icon: 'hottest-takes',
  },
  guitar: {
    id: 'sec-guitar',
    label: { en: 'Guitar and mixer', pt: 'Guitarra e mixer' },
    srLabel: { en: 'Guitar and mixer', pt: 'Guitarra e mixer' },
    icon: 'guitar',
  },
  contact: {
    id: 'sec-contact',
    label: { en: 'Contact', pt: 'Contato' },
    srLabel: { en: 'Contact', pt: 'Contato' },
    icon: 'contact',
  },
} as const satisfies Record<
  string,
  {
    id: string;
    label: Record<SiteLocale, string>;
    srLabel: Record<SiteLocale, string>;
    icon: string;
  }
>;

type SectionKey = keyof typeof SECTIONS;
type SectionDefinition = (typeof SECTIONS)[SectionKey];

const FIRST_SECTION_ORDER = 1;
const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[];

const pickByKey = <T>(select: (section: SectionDefinition) => T): Record<SectionKey, T> =>
  Object.fromEntries(SECTION_KEYS.map((key) => [key, select(SECTIONS[key])])) as Record<
    SectionKey,
    T
  >;

export const SECTION_ICONS = pickByKey(({ icon }) => icon) as {
  [K in SectionKey]: (typeof SECTIONS)[K]['icon'];
};

export const SECTION_ID = pickByKey(({ id }) => id) as {
  [K in SectionKey]: (typeof SECTIONS)[K]['id'];
};

type OrderedSection = SectionDefinition & { readonly order: number };

const ORDERED_SECTIONS = SECTION_KEYS.map((key, index) => ({
  ...SECTIONS[key],
  order: FIRST_SECTION_ORDER + index,
})) as unknown as readonly [OrderedSection, ...OrderedSection[]];

export const SECTION_NAV = ORDERED_SECTIONS.map(({ id, label, order }) => ({
  id,
  label,
  order,
})) as unknown as readonly [
  Pick<OrderedSection, 'id' | 'label' | 'order'>,
  ...Pick<OrderedSection, 'id' | 'label' | 'order'>[],
];

export const SECTION_REGISTRY = ORDERED_SECTIONS;

export type SectionRegistryEntry = (typeof SECTION_REGISTRY)[number];
export type SectionId = SectionRegistryEntry['id'];
export type LocalizedLabel = Record<SiteLocale, string>;

export const localizedSectionLabel = (locale: SiteLocale, id: SectionId): string =>
  SECTION_NAV.find((section) => section.id === id)?.label[locale] ?? id;

export const sectionPath = (locale: SiteLocale, id: SectionId): string =>
  localizedPath(locale, `/#${id}`);
