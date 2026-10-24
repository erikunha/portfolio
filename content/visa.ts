import { type VisaRow, VisaRowSchema, WORK_AUTH_STATUS } from './schemas';

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

export const workAuthorizationSummary = visaRows
  .map((row) => `${row.jurisdiction}: ${row.status}`)
  .join(' · ');
