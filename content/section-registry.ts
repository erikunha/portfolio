import { SECTION_ICONS, type Section, SectionRegistrySchema } from './schemas';

export const SECTION_REGISTRY = [
  {
    id: 'bio',
    label: 'Home',
    srLabel: 'Home',
    aliases: ['home', 'bio', 'hero', 'whoami'],
    order: 1,
    icon: SECTION_ICONS.home,
  },
  {
    id: 'sec-readme',
    label: 'About',
    srLabel: 'About',
    aliases: ['about', 'readme', 'sec-about', 'principles', 'stack', 'now'],
    order: 2,
    icon: SECTION_ICONS.about,
  },
  {
    id: 'sec-projects',
    label: 'Projects',
    srLabel: 'Projects',
    aliases: ['projects', 'work', 'portfolio', 'receipts'],
    order: 3,
    icon: SECTION_ICONS.projects,
  },
  {
    id: 'sec-git-log',
    label: 'Career',
    srLabel: 'Career history',
    aliases: ['career', 'experience', 'git log', 'education', 'certifications', 'community'],
    order: 4,
    icon: SECTION_ICONS.career,
  },
  {
    id: 'sec-shell',
    label: 'Interactive shell',
    srLabel: 'Interactive shell',
    aliases: ['interactive shell', 'shell', 'terminal', 'ask'],
    order: 5,
    icon: SECTION_ICONS.shell,
  },
  {
    id: 'sec-live-perf',
    label: 'Measured',
    srLabel: 'Live performance',
    aliases: ['measured', 'sec-live-metrics', 'performance', 'metrics', 'lighthouse', 'evals'],
    order: 6,
    icon: SECTION_ICONS.measured,
  },
  {
    id: 'sec-hottest-takes',
    label: 'Opinions',
    srLabel: 'Opinions',
    aliases: ['opinions', 'hottest takes', 'takes', 'unknowns'],
    order: 7,
    icon: SECTION_ICONS.opinions,
  },
  {
    id: 'sec-guitar',
    label: 'Guitar and mixer',
    srLabel: 'Guitar rig',
    aliases: ['guitar and mixer', 'guitar', 'mixer', 'daw', 'music'],
    order: 8,
    icon: SECTION_ICONS.guitar,
  },
  {
    id: 'sec-contact',
    label: 'Contact',
    srLabel: 'Contact',
    aliases: ['contact', 'email', 'message'],
    order: 9,
    icon: SECTION_ICONS.contact,
  },
] as const satisfies readonly Section[];

SectionRegistrySchema.parse(SECTION_REGISTRY);

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
