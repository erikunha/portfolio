import type { gitLog } from '@/content/git-log';
import type { SITE_LOCALE } from '@/content/site-locale';

export type CareerEntry = (typeof gitLog)[typeof SITE_LOCALE.en][number];

export const formatEmploymentContext = (entry: CareerEntry): string =>
  entry.context ? ` Context: ${entry.context}` : '';

export const formatEmploymentHighlights = (entry: CareerEntry): string =>
  entry.highlights.map((highlight) => `\n  - ${highlight}.`).join('');

export const formatEmployment = (entry: CareerEntry): string => {
  const header = `- ${entry.company}${entry.companyUrl ? ` (${entry.companyUrl})` : ''}: ${entry.role}. ${entry.date}. ${entry.location}${entry.workMode ? ` (${entry.workMode})` : ''}. ${entry.body.join(' ')}`;
  return `${header}${formatEmploymentContext(entry)}${formatEmploymentHighlights(entry)}`;
};
