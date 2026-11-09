import type { AskFacts } from '@/content/schemas';

export const formatDecision = (entry: AskFacts['decisions'][number]): string =>
  `- ${entry.decision}. Rejected: ${entry.rejected}. Why: ${entry.because}.`;

export const formatStory = (entry: AskFacts['stories'][number]): string =>
  `- ${entry.title}: ${entry.text}`;
