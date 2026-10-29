import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { gitLog } from '@/content/git-log';
import { READING_PATHS } from '@/content/reading-views';
import { GitLogContent, GitLogSection } from './GitLogSection';

vi.mock('next/headers', () => ({
  headers: () => {
    throw new Error('Career must render without request headers');
  },
}));

describe('career git log', () => {
  it('renders nine jobs in one ordered log with complete resume facts', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(GitLogContent());
    expect(host.querySelectorAll('[data-testid="career-log"]')).toHaveLength(1);
    const log = host.querySelector('ol');
    expect(log).not.toBeNull();
    const jobs = Array.from(log?.children ?? []);
    expect(jobs).toHaveLength(9);
    gitLog.forEach((job, index) => {
      const row = jobs[index];
      expect(row?.textContent).toContain(job.role.toUpperCase());
      expect(row?.textContent).toContain(job.location.replace(', Brazil', ', BR'));
      expect(row?.textContent).toContain(job.date);
      expect(row?.textContent).toContain(job.body.join(' '));
      expect(row?.textContent).toContain(job.hash.slice(0, 7));
      if (job.workMode) expect(row?.textContent).toContain(`(${job.workMode})`);
      expect(row?.querySelector('[aria-hidden="true"]')?.textContent).toMatch(/^\*\n\|/);
      expect(row?.querySelector('.career-hash')?.getAttribute('aria-hidden')).toBe('true');
      expect(row?.querySelector('.career-decoration')?.getAttribute('aria-hidden')).toBe('true');
    });
    expect(host.querySelector('pre')).toBeNull();
    expect(host.textContent).not.toContain('AuthorDate:');
    expect(host.textContent).toContain('git log --oneline --decorate --graph ~/career');
  });

  it('includes credentials once inside Career and retains a usable CV action', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<GitLogSection />);
    const career = host.querySelector('#sec-git-log');
    expect(career?.textContent).toContain("git tag --list 'cert/*'");
    expect(career?.textContent).toContain("git tag --list 'edu/*'");
    expect(career?.textContent).toContain("git tag --list 'community/*'");
    const action = career?.querySelector('a.career-cv');
    expect(action?.textContent).toBe('VIEW_CV');
    expect(action?.getAttribute('href')).toBe(READING_PATHS.cv);
    expect(host.querySelectorAll('#sec-credentials')).toHaveLength(1);
  });
});
