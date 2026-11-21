import type { Credential, Education } from '@/content/schemas';

const CREDENTIAL_SUMMARY_SEPARATOR = ' · ';

export const formatEducationLocation = (entry: Education): string =>
  entry.studyMode ? `${entry.location} (${entry.studyMode})` : entry.location;

export const formatEducationLine = (entry: Education): string =>
  `- ${entry.degree}, ${entry.institution}, ${formatEducationLocation(entry)}, ${entry.period}${entry.focus ? `: ${entry.focus}` : ''}`;

export const formatCredentialLine = (entry: Credential): string =>
  `- ${entry.label}: ${entry.badge}, ${entry.evidence}`;

export const formatCredentialSummary = (entry: Credential): string =>
  [entry.label, entry.badge, entry.evidence].join(CREDENTIAL_SUMMARY_SEPARATOR);
