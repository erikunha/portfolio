import { projects } from '@/content/projects';
import type { AskFacts } from '@/content/schemas';
import { SITE_LOCALE } from '@/content/site-locale';
import { unknowns } from '@/content/unknowns';

export const formatDecision = (entry: AskFacts['decisions'][number]): string =>
  `- ${entry.decision}. Rejected: ${entry.rejected}. Why: ${entry.because}.`;

export const formatStory = (entry: AskFacts['stories'][number]): string =>
  `- ${entry.title}: ${entry.text}`;

export const formatProjects = (): string =>
  projects[SITE_LOCALE.en]
    .map((p) => {
      const stats = p.stats.map((s) => `${s.label}: ${s.value}`).join(' · ');
      return `- ${p.name} (${p.company}): ${p.description}\n  ${stats}`;
    })
    .join('\n');

export const formatUnknowns = (): string => {
  const learning = unknowns[SITE_LOCALE.en].learning
    .map((u) => `- ${u.claim} · ${u.context}`)
    .join('\n');
  const notSpec = unknowns[SITE_LOCALE.en].notSpecializing
    .map((u) => `- ${u.claim} · ${u.context}`)
    .join('\n');
  return `### Currently learning\n${learning}\n\n### Not specializing in\n${notSpec}`;
};
