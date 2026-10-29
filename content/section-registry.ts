import type { Section } from './schemas';

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
  { id: 'bio', label: 'Home', order: 1 },
  { id: 'sec-readme', label: 'About', order: 2 },
  { id: 'sec-projects', label: 'Projects', order: 3 },
  { id: 'sec-git-log', label: 'Career', order: 4 },
  { id: 'sec-shell', label: 'Interactive shell', order: 5 },
  { id: 'sec-live-perf', label: 'Measured', order: 6 },
  { id: 'sec-hottest-takes', label: 'Opinions', order: 7 },
  { id: 'sec-guitar', label: 'Guitar and mixer', order: 8 },
  { id: 'sec-contact', label: 'Contact', order: 9 },
] as const;

export const SECTION_REGISTRY = [
  {
    ...SECTION_NAV[0],
    srLabel: 'Home',
    aliases: ['home', 'bio', 'hero', 'whoami'],
    icon: SECTION_ICONS.home,
  },
  {
    ...SECTION_NAV[1],
    srLabel: 'About',
    aliases: ['about', 'readme', 'sec-about', 'principles', 'stack', 'now'],
    icon: SECTION_ICONS.about,
  },
  {
    ...SECTION_NAV[2],
    srLabel: 'Projects',
    aliases: ['projects', 'work', 'portfolio', 'receipts'],
    icon: SECTION_ICONS.projects,
  },
  {
    ...SECTION_NAV[3],
    srLabel: 'Career history',
    aliases: ['career', 'experience', 'git log', 'education', 'certifications', 'community'],
    icon: SECTION_ICONS.career,
  },
  {
    ...SECTION_NAV[4],
    srLabel: 'Interactive shell',
    aliases: ['interactive shell', 'shell', 'terminal', 'ask'],
    icon: SECTION_ICONS.shell,
  },
  {
    ...SECTION_NAV[5],
    srLabel: 'Live performance',
    aliases: ['measured', 'sec-live-metrics', 'performance', 'metrics', 'lighthouse', 'evals'],
    icon: SECTION_ICONS.measured,
  },
  {
    ...SECTION_NAV[6],
    srLabel: 'Opinions',
    aliases: ['opinions', 'hottest takes', 'takes', 'unknowns'],
    icon: SECTION_ICONS.opinions,
  },
  {
    ...SECTION_NAV[7],
    srLabel: 'Guitar rig',
    aliases: ['guitar and mixer', 'guitar', 'mixer', 'daw', 'music'],
    icon: SECTION_ICONS.guitar,
  },
  {
    ...SECTION_NAV[8],
    srLabel: 'Contact',
    aliases: ['contact', 'email', 'message'],
    icon: SECTION_ICONS.contact,
  },
] as const satisfies readonly Section[];

export type SectionRegistryEntry = (typeof SECTION_REGISTRY)[number];
export type SectionId = SectionRegistryEntry['id'];

export function getSectionById(id: string): SectionRegistryEntry | undefined {
  return SECTION_REGISTRY.find((section) => section.id === id);
}

export function getSectionByAlias(alias: string): SectionRegistryEntry | undefined {
  const normalizedAlias = alias.trim().toLowerCase();
  return SECTION_REGISTRY.find((section) =>
    section.aliases.some((candidate) => candidate === normalizedAlias),
  );
}
