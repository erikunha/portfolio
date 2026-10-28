import { type VisaRow, VisaRowSchema, VisaUiSchema, WORK_AUTH_STATUS } from './schemas';

export const visaUi = VisaUiSchema.parse({
  title: 'Work authorization',
  command: 'CAT ~/.VISA',
  jurisdictionLabel: 'JURISDICTION',
  statusLabel: 'STATUS',
  evidenceLabel: 'EVIDENCE',
});

export const workAuthorization = {
  Brazil: WORK_AUTH_STATUS.citizen,
  EU_Malta: WORK_AUTH_STATUS.needsSponsorship,
  Canada: WORK_AUTH_STATUS.needsSponsorship,
  worldwide: WORK_AUTH_STATUS.openWithSponsorship,
};

export const visaRows: VisaRow[] = VisaRowSchema.array().parse([
  {
    jurisdiction: 'Brazil',
    jurisdictionShort: 'BR',
    status: workAuthorization.Brazil,
    statusShort: workAuthorization.Brazil,
    evidence: 'Brazilian citizen',
  },
  {
    jurisdiction: 'EU (Malta)',
    jurisdictionShort: 'EU (MT)',
    status: workAuthorization.EU_Malta,
    statusShort: workAuthorization.EU_Malta,
    evidence: 'worked in Malta via Betsson, 2025-2026',
  },
  {
    jurisdiction: 'Canada',
    jurisdictionShort: 'CA',
    status: workAuthorization.Canada,
    statusShort: workAuthorization.Canada,
    evidence: 'lived and worked in Vancouver, 2023-2025 · co-op diploma, CICCC',
  },
  {
    jurisdiction: 'Worldwide',
    jurisdictionShort: 'WORLD',
    status: workAuthorization.worldwide,
    statusShort: workAuthorization.worldwide,
    evidence: 'remote or relocation · available now',
  },
]);

const WORK_AUTH_STATUS_PROSE: Record<(typeof visaRows)[number]['status'], string> = {
  CITIZEN: 'citizen',
  NEEDS_SPONSORSHIP: 'needs sponsorship',
  OPEN_WITH_SPONSORSHIP: 'open with sponsorship',
};

export const workAuthorizationSummary = visaRows
  .map((row) => `${row.jurisdiction}: ${row.status}`)
  .join(' · ');

export const workAuthorizationProse = visaRows
  .map((row) => `${row.jurisdiction}: ${WORK_AUTH_STATUS_PROSE[row.status]}`)
  .join(' · ');
