import { askFacts } from '@/content/ask-facts';
import { credentials } from '@/content/credentials';
import { education } from '@/content/education';
import { gitLog } from '@/content/git-log';
import { perfReceipts } from '@/content/perf-receipts';
import {
  FUNDS_PHRASE,
  profile,
  profileLanguageLine,
  profilePresentation,
  YEARS_OF_EXPERIENCE_LABEL,
} from '@/content/profile';
import { SITE_LOCALE } from '@/content/site-locale';
import {
  formatDecision,
  formatProjects,
  formatStory,
  formatUnknowns,
} from '@/lib/ask/ask-fact-format';
import { formatEmploymentContext, formatEmploymentHighlights } from '@/lib/ask/employment-format';

const ISO_DATE_LENGTH = 10;
const CURRENT_ROLE_MARKER = 'current role';

export function buildJudgeFactSheet(today: Date): string {
  const employment = gitLog[SITE_LOCALE.en].map((entry) => {
    const current = entry.endMonth === null ? ` (${CURRENT_ROLE_MARKER})` : '';
    return `- ${entry.company}: ${entry.role}, ${entry.date}, employer location ${entry.location}${entry.workMode ? `, ${entry.workMode}` : ''}${current}. ${entry.body.join(' ')}${formatEmploymentContext(entry)}${formatEmploymentHighlights(entry)}`;
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
    `Work scope: ${askFacts.openTo}`,
    ...askFacts.targeting,
    `Current title: ${profile.title}`,
    `Current employer: ${profile.currentEmployer.name}, ${profilePresentation[SITE_LOCALE.en].employerContext}, ${FUNDS_PHRASE}`,
    `Experience: ${YEARS_OF_EXPERIENCE_LABEL} in production systems`,
    `Core stack: ${profile.stackLine}`,
    `AI focus: ${profile.aiLine}`,
    'Skills by area:',
    ...askFacts.coreStack.map((line) => `- ${line}`),
    'Current role scope:',
    ...askFacts.currentRoleScope.map((line) => `- ${line}`),
    'Detail on the current role:',
    ...askFacts.currentRoleDetail.map((line) => `- ${line}`),
    'How Erik works:',
    ...askFacts.workingStyle.map((line) => `- ${line}`),
    'Decisions and the alternative he rejected:',
    ...askFacts.decisions.map(formatDecision),
    'Stories:',
    ...askFacts.stories.map(formatStory),
    'Opinions he states:',
    ...askFacts.opinions.map((line) => `- ${line}`),
    'Community and writing:',
    ...askFacts.community.map((line) => `- ${line}`),
    'Limits Erik states about his own record (what he does not claim):',
    ...askFacts.calibration.map((line) => `- ${line}`),
    'Project detail (LedgerLens, personal project, public repository):',
    ...askFacts.projectDetail.map((line) => `- ${line}`),
    'Projects:',
    formatProjects(),
    'Learning and not specializing in:',
    formatUnknowns(),
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
