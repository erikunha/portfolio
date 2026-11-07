import { education } from '@/content/education';
import { gitLog } from '@/content/git-log';
import { profileLanguageLine } from '@/content/profile';
import { SITE_LOCALE } from '@/content/site-locale';

const ISO_DATE_LENGTH = 10;
const CURRENT_ROLE_MARKER = 'current role';

export function buildJudgeFactSheet(today: Date): string {
  const employment = gitLog[SITE_LOCALE.en].map((entry) => {
    const current = entry.endMonth === null ? ` (${CURRENT_ROLE_MARKER})` : '';
    return `- ${entry.company}: ${entry.role}, ${entry.date}, ${entry.location}${current}`;
  });
  const schooling = education[SITE_LOCALE.en].map(
    (entry) => `- ${entry.degree}, ${entry.institution}, ${entry.period}`,
  );
  return [
    `Today's date: ${today.toISOString().slice(0, ISO_DATE_LENGTH)}`,
    'Employment, newest first:',
    ...employment,
    'Education:',
    ...schooling,
    `Languages: ${profileLanguageLine}`,
  ].join('\n');
}
