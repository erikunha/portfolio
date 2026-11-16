import { describe, expect, it } from 'vitest';

import { EMAIL_ADDRESS } from '@/content/social-urls';
import { parseSecurityTxt } from '@/lib/security-txt';

const MS_PER_DAY = 86_400_000;
const EXPIRES = '2027-11-15T00:00:00.000Z';
const EXPIRES_MS = Date.parse(EXPIRES);

function fileWith(overrides: Record<string, string | null> = {}): string {
  const fields: Record<string, string | null> = {
    Contact: `mailto:${EMAIL_ADDRESS}`,
    Expires: EXPIRES,
    'Preferred-Languages': 'en, pt',
    Policy: 'https://github.com/erikunha/portfolio/security/policy',
    Canonical: 'https://www.erikunha.dev/.well-known/security.txt',
    ...overrides,
  };
  return `${Object.entries(fields)
    .filter(([, value]) => value !== null)
    .map(([name, value]) => `${name}: ${value}`)
    .join('\n')}\n`;
}

function daysBeforeExpiry(days: number): Date {
  return new Date(EXPIRES_MS - days * MS_PER_DAY);
}

const NOW = daysBeforeExpiry(365);

describe('parseSecurityTxt', () => {
  it('accepts the complete file with a year left', () => {
    expect(parseSecurityTxt(fileWith(), NOW).problems).toEqual([]);
  });

  it('accepts comment and blank lines', () => {
    const text = `# security contact\n\n${fileWith()}`;
    expect(parseSecurityTxt(text, NOW).problems).toEqual([]);
  });

  it('accepts an https contact', () => {
    const text = fileWith({ Contact: 'https://example.com/security' });
    expect(parseSecurityTxt(text, NOW).problems).toEqual([]);
  });

  it('accepts 31 days left', () => {
    expect(parseSecurityTxt(fileWith(), daysBeforeExpiry(31)).problems).toEqual([]);
  });

  it('fails 29 days before Expires', () => {
    const report = parseSecurityTxt(fileWith(), daysBeforeExpiry(29));
    expect(report.problems).toEqual([expect.stringContaining('30 days')]);
  });

  it('fails after Expires', () => {
    const report = parseSecurityTxt(fileWith(), new Date(EXPIRES_MS + MS_PER_DAY));
    expect(report.problems).toEqual([expect.stringContaining('30 days')]);
  });

  it('reads the fields it validates', () => {
    const report = parseSecurityTxt(fileWith(), NOW);
    expect(report.fields.Expires).toEqual([EXPIRES]);
    expect(report.fields['Preferred-Languages']).toEqual(['en, pt']);
  });

  it.each([
    ['a missing Contact', { Contact: null }, 'Contact'],
    ['an http Contact', { Contact: 'http://example.com/security' }, 'Contact'],
    ['a tel Contact', { Contact: 'tel:+15555550100' }, 'Contact'],
    ['another mailto address', { Contact: 'mailto:someone@example.com' }, 'Contact'],
    ['a missing Expires', { Expires: null }, 'Expires'],
    ['an Expires with an offset', { Expires: '2027-11-15T00:00:00.000+02:00' }, 'Expires'],
    ['an Expires without a zone', { Expires: '2027-11-15T00:00:00' }, 'Expires'],
    ['an Expires date only', { Expires: '2027-11-15' }, 'Expires'],
    ['an impossible Expires date', { Expires: '2027-13-45T00:00:00Z' }, 'Expires'],
    ['a missing Canonical', { Canonical: null }, 'Canonical'],
    [
      'a Canonical on the apex host',
      { Canonical: 'https://erikunha.dev/.well-known/security.txt' },
      'Canonical',
    ],
    [
      'an http Canonical',
      { Canonical: 'http://www.erikunha.dev/.well-known/security.txt' },
      'Canonical',
    ],
    [
      'a Canonical at the wrong path',
      { Canonical: 'https://www.erikunha.dev/security.txt' },
      'Canonical',
    ],
    ['a missing Preferred-Languages', { 'Preferred-Languages': null }, 'Preferred-Languages'],
    ['other Preferred-Languages', { 'Preferred-Languages': 'en' }, 'Preferred-Languages'],
    ['a missing Policy', { Policy: null }, 'Policy'],
    ['an http Policy', { Policy: 'http://example.com/policy' }, 'Policy'],
  ] as const)('reports %s', (_label, overrides, field) => {
    const report = parseSecurityTxt(fileWith(overrides), NOW);
    expect(report.problems.length).toBeGreaterThan(0);
    expect(report.problems.every((problem) => problem.includes(field))).toBe(true);
  });

  it('reports a repeated Expires', () => {
    const report = parseSecurityTxt(`${fileWith()}Expires: ${EXPIRES}\n`, NOW);
    expect(report.problems).toEqual([expect.stringContaining('Expires')]);
  });

  it('reports a line that is not a field', () => {
    const report = parseSecurityTxt(`${fileWith()}not a field\n`, NOW);
    expect(report.problems).toEqual([expect.stringContaining('not a field')]);
  });
});
