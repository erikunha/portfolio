import { credentials } from '@/content/credentials';
import { education } from '@/content/education';
import { gitLog } from '@/content/git-log';
import { perfReceipts } from '@/content/perf-receipts';
import {
  FUNDS_PHRASE,
  profile,
  profileLanguageLine,
  YEARS_OF_EXPERIENCE_LABEL,
} from '@/content/profile';
import { SITE_LOCALE } from '@/content/site-locale';
import { WORK_SCOPE_SENTENCE } from '@/content/work-scope';

const ISO_DATE_LENGTH = 10;
const CURRENT_ROLE_MARKER = 'current role';

export function buildJudgeFactSheet(today: Date): string {
  const employment = gitLog[SITE_LOCALE.en].map((entry) => {
    const current = entry.endMonth === null ? ` (${CURRENT_ROLE_MARKER})` : '';
    return `- ${entry.company}: ${entry.role}, ${entry.date}, employer location ${entry.location}${entry.workMode ? `, ${entry.workMode}` : ''}${current}. ${entry.body.join(' ')}`;
  });
  const schooling = education[SITE_LOCALE.en].map(
    (entry) => `- ${entry.degree}, ${entry.institution}, ${entry.period}`,
  );
  const certifications = credentials.map(
    (entry) => `- ${entry.label}: ${entry.badge}, ${entry.evidence}`,
  );
  const receipts = perfReceipts[SITE_LOCALE.en].map(
    (receipt) => `- ${receipt.metric} ${receipt.delta} ${receipt.company}: ${receipt.note}`,
  );
  return [
    `Today's date: ${today.toISOString().slice(0, ISO_DATE_LENGTH)}`,
    `Erik lives in: ${profile.city}, ${profile.country} (${profile.timezone})`,
    `Open to: ${WORK_SCOPE_SENTENCE}`,
    `Current title: ${profile.title}`,
    `Current employer: ${profile.currentEmployer.name}, ${profile.currentEmployer.context}, ${FUNDS_PHRASE}`,
    `Experience: ${YEARS_OF_EXPERIENCE_LABEL} in production systems`,
    `Core stack: ${profile.stackLine}`,
    `AI focus: ${profile.aiLine}`,
    'Credentials (all verified):',
    ...certifications,
    'Performance receipts (all verified):',
    ...receipts,
    'Employment, newest first:',
    ...employment,
    'Education:',
    ...schooling,
    `Languages: ${profileLanguageLine}`,
  ].join('\n');
}
