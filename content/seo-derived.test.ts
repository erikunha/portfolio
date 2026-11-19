import { describe, expect, it } from 'vitest';
import { credentials } from './credentials';
import { education } from './education';
import { isCompletedEducation, isSchemaCredential, personSchema } from './seo';
import { SITE_LOCALE } from './site-locale';

const HEAD_ALUMNI_OF = [
  {
    '@type': 'CollegeOrUniversity',
    name: 'Cornerstone International Community College of Canada (CICCC)',
    address: { '@type': 'PostalAddress', addressLocality: 'Vancouver', addressCountry: 'CA' },
  },
  {
    '@type': 'CollegeOrUniversity',
    name: 'Centro Universitário Salesiano de São Paulo (UNISAL)',
    address: { '@type': 'PostalAddress', addressLocality: 'Campinas', addressCountry: 'BR' },
  },
];

const HEAD_HAS_CREDENTIAL = [
  {
    '@type': 'EducationalOccupationalCredential',
    name: 'Angular Developer Certification',
    credentialCategory: 'certification',
    recognizedBy: { '@type': 'Organization', name: 'certificates.dev' },
  },
  {
    '@type': 'EducationalOccupationalCredential',
    name: 'Verified International Academic Qualifications',
    credentialCategory: 'certification',
    recognizedBy: { '@type': 'Organization', name: 'World Education Services (WES)' },
  },
];

describe('derived schema.org education and credentials', () => {
  it('keeps alumniOf identical to the committed JSON-LD', () => {
    expect(JSON.parse(JSON.stringify(personSchema.alumniOf))).toEqual(HEAD_ALUMNI_OF);
  });

  it('keeps hasCredential identical to the committed JSON-LD', () => {
    expect(JSON.parse(JSON.stringify(personSchema.hasCredential))).toEqual(HEAD_HAS_CREDENTIAL);
  });

  it('names an institution from education for every alumniOf entry', () => {
    const completed = education[SITE_LOCALE.en].filter(isCompletedEducation);
    expect(personSchema.alumniOf.map((entry) => entry.name)).toEqual(
      completed.map((entry) => entry.institution),
    );
  });

  it('excludes the MBA in progress', () => {
    const mba = education[SITE_LOCALE.en].find((entry) => entry.id === 'MBA_AI_ENG');
    expect(mba).toBeDefined();
    expect(mba && isCompletedEducation(mba)).toBe(false);
    expect(JSON.stringify(personSchema.alumniOf)).not.toContain(mba?.institution ?? '');
  });

  it('treats an entry with an expected completion as in progress (negative control)', () => {
    const done = education[SITE_LOCALE.en].find(isCompletedEducation);
    expect(done).toBeDefined();
    expect(done && isCompletedEducation({ ...done, expectedCompletion: '2030-01' })).toBe(false);
  });

  it('derives hasCredential from credentials that carry schema.org data', () => {
    const labels = credentials.filter(isSchemaCredential).map((entry) => entry.label);
    expect(labels).toEqual(['ANGULAR_DEVELOPER', 'INTL_DEGREE']);
    expect(personSchema.hasCredential).toHaveLength(labels.length);
  });

  it('leaves the language test out of hasCredential', () => {
    expect(credentials.map((entry) => entry.label)).toContain('ENGLISH');
    expect(isSchemaCredential({ label: 'ENGLISH', badge: 'x', evidence: 'x' })).toBe(false);
  });
});
