import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { gitLog } from '@/content/git-log';
import { profile } from '@/content/profile';
import { cvJsonLd } from '@/content/reading-views';
import { personSchema } from '@/content/seo';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';
import { HIRING_PROFILE } from '@/lib/hiring-profile';

const llmsTxt = readFileSync(path.resolve(__dirname, '../public/llms.txt'), 'utf-8');

const companyName = (company: string) => company.split(' (')[0] ?? company;

describe('every machine-readable surface links employers to their company site', () => {
  const [current] = gitLog;

  it('keeps profile.currentEmployer on the first career entry, name and URL', () => {
    expect(current?.company).toBe(profile.currentEmployer.name);
    expect(
      current?.companyUrl,
      'profile.currentEmployer.url and gitLog[0].companyUrl drifted: the hero, the summary and the career log would link two different sites',
    ).toBe(profile.currentEmployer.url);
  });

  it('publishes the current employer URL in the Person and ProfilePage JSON-LD', () => {
    expect(personSchema.worksFor.url).toBe(profile.currentEmployer.url);
    expect(cvJsonLd.mainEntity.worksFor).toEqual({
      '@type': 'Organization',
      name: profile.currentEmployer.name,
      url: profile.currentEmployer.url,
    });
  });

  it('adds the company URL to every employer in the hiring profile', () => {
    expect(HIRING_PROFILE.employers.map((employer) => employer.url)).toEqual(
      gitLog.map((entry) => entry.companyUrl),
    );
  });

  it('links every employer in the llms.txt experience table', () => {
    for (const entry of gitLog) {
      expect(
        llmsTxt,
        `public/llms.txt must link ${entry.company} to ${entry.companyUrl} in the Professional Experience table`,
      ).toContain(`| [${entry.company}](${entry.companyUrl}) |`);
    }
  });

  it('hands the ask prompt each company URL so answers cite the real site', () => {
    for (const entry of gitLog) {
      expect(SYSTEM_TEXT).toContain(`- ${entry.company} (${entry.companyUrl}):`);
    }
  });

  it('keeps every project company resolvable to an employer URL', async () => {
    const { projects } = await import('@/content/projects');
    const { companyUrlFor } = await import('@/content/git-log');
    for (const project of projects.filter((entry) => entry.kind === 'professional')) {
      const employer = gitLog.find((entry) => companyName(entry.company) === project.company);
      expect(employer, project.company).toBeDefined();
      expect(companyUrlFor(project.company)).toBe(employer?.companyUrl);
    }
    expect(() => companyUrlFor('Unknown Employer')).toThrow(/Unknown Employer/);
  });
});
