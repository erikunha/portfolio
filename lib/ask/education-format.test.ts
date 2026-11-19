import { describe, expect, it } from 'vitest';
import { credentials } from '@/content/credentials';
import { education } from '@/content/education';
import type { Credential, Education } from '@/content/schemas';
import { SITE_LOCALE } from '@/content/site-locale';
import {
  formatCredentialLine,
  formatCredentialSummary,
  formatEducationLine,
  formatEducationLocation,
} from '@/lib/ask/education-format';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';
import { HIRING_PROFILE } from '@/lib/hiring-profile';

const baseEntry: Education = {
  id: 'BS_INFO_SYSTEMS',
  degree: 'Degree',
  institution: 'Institution',
  location: 'City, Country',
  studyMode: null,
  startYear: 2015,
  endYear: 2020,
  expectedCompletion: null,
  period: '2015-2020',
};

const credential: Credential = { label: 'LABEL', badge: 'BADGE', evidence: 'issuer · 2024' };

describe('formatEducationLocation', () => {
  it.each([
    ['no study mode', { studyMode: null }, 'City, Country'],
    ['a study mode', { studyMode: 'online' }, 'City, Country (online)'],
  ])('renders %s', (_name, patch, expected) => {
    expect(formatEducationLocation({ ...baseEntry, ...patch })).toBe(expected);
  });
});

describe('formatEducationLine', () => {
  it.each([
    ['no study mode and no focus', {}, '- Degree, Institution, City, Country, 2015-2020'],
    [
      'a study mode',
      { studyMode: 'online' },
      '- Degree, Institution, City, Country (online), 2015-2020',
    ],
    [
      'a focus',
      { focus: 'Coursework: X' },
      '- Degree, Institution, City, Country, 2015-2020: Coursework: X',
    ],
    [
      'a study mode and a focus',
      { studyMode: 'online', focus: 'Coursework: X' },
      '- Degree, Institution, City, Country (online), 2015-2020: Coursework: X',
    ],
  ])('renders %s', (_name, patch, expected) => {
    expect(formatEducationLine({ ...baseEntry, ...patch })).toBe(expected);
  });
});

describe('credential formatters', () => {
  it('renders the prompt line as label, then badge and evidence', () => {
    expect(formatCredentialLine(credential)).toBe('- LABEL: BADGE, issuer · 2024');
  });

  it('renders the hiring profile summary as three parts joined by a middle dot', () => {
    expect(formatCredentialSummary(credential)).toBe('LABEL · BADGE · issuer · 2024');
  });
});

describe('the two callers share the formatters', () => {
  const entries = education[SITE_LOCALE.en];

  it('puts every education line in the system prompt', () => {
    for (const entry of entries) {
      expect(SYSTEM_TEXT).toContain(formatEducationLine(entry));
    }
  });

  it('puts every credential line in the system prompt', () => {
    for (const entry of credentials) {
      expect(SYSTEM_TEXT).toContain(formatCredentialLine(entry));
    }
  });

  it('uses the shared location in the hiring profile', () => {
    expect(HIRING_PROFILE.education.map((entry) => entry.location)).toEqual(
      entries.map(formatEducationLocation),
    );
  });

  it('uses the shared summary for the hiring profile certifications', () => {
    expect(HIRING_PROFILE.certifications).toEqual(credentials.map(formatCredentialSummary));
  });
});
