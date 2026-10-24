import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { education } from '@/content/education';
import { gitLog } from '@/content/git-log';
import { GitLogSection } from './GitLogSection';

describe('Career git log', () => {
  it('renders nine jobs in reverse chronological reading order with complete employment details', () => {
    const { getByRole } = render(<GitLogSection />);
    const list = getByRole('list', { name: 'Employment history' });
    expect(list.tagName).toBe('OL');
    const jobs = within(list).getAllByRole('listitem');
    expect(jobs).toHaveLength(9);
    expect(jobs.map((job) => within(job).getByRole('heading').textContent)).toEqual([
      'Raylu',
      'Betsson Group',
      'Canon Medical Systems',
      'Grupo SBF (Nike / Centauro)',
      'Encora (formerly Daitan)',
      'ZUP Innovation (Itaú Unibanco)',
      'Venturus',
      'MB Labs',
      'Monde Sistemas',
    ]);
    jobs.forEach((job, index) => {
      const entry = gitLog[index];
      if (!entry) throw new Error('Missing canonical employment entry');
      expect(job.textContent).toContain(entry.role);
      expect(job.textContent).toContain(entry.location);
      if (entry.workMode) expect(job.textContent).toContain(entry.workMode);
      expect(job.textContent).toContain(entry.date);
      expect(job.querySelector('time')?.getAttribute('datetime')).toBe(entry.startMonth);
      if (entry.endMonth) {
        expect(job.querySelectorAll('time')[1]?.getAttribute('datetime')).toBe(entry.endMonth);
      }
      expect(within(job).getByRole('heading').closest('[aria-hidden="true"]')).toBeNull();
    });
  });

  it('hides the graph, commit stars, hashes and refs from assistive technology', () => {
    const { getByRole } = render(<GitLogSection />);
    const jobs = within(getByRole('list', { name: 'Employment history' })).getAllByRole('listitem');
    for (const job of jobs) {
      const graph = within(job).getByText('*');
      expect(graph.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(within(job).getByText('|').closest('[aria-hidden="true"]')).not.toBeNull();
    }
    for (const entry of gitLog) {
      const hash = within(getByRole('list', { name: 'Employment history' })).getByText(
        entry.hash.slice(0, 7),
      );
      expect(hash.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(
        within(getByRole('list', { name: 'Employment history' }))
          .getByText(entry.deco)
          .closest('[aria-hidden="true"]'),
      ).not.toBeNull();
    }
  });

  it('keeps education out of employment and groups certifications, education and community under Career', () => {
    const { getByRole } = render(<GitLogSection />);
    const career = getByRole('region', { name: 'Career' });
    const jobs = getByRole('list', { name: 'Employment history' });
    for (const entry of education) {
      expect(jobs.textContent).not.toContain(entry.institution);
      expect(jobs.textContent).not.toContain(entry.degree);
    }
    expect(
      within(career)
        .getAllByRole('region')
        .map((group) => within(group).getByRole('heading', { level: 3 }).textContent),
    ).toEqual(['Certifications', 'Education', 'Community']);
    expect(within(career).getByRole('link', { name: 'View CV' }).getAttribute('href')).toBe(
      '/erik-cunha-cv.pdf',
    );
  });
});
