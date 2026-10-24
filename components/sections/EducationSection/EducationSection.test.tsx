import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { education } from '@/content/education';
import { EducationSection } from './EducationSection';

describe('Education group', () => {
  it('renders each canonical institution, credential and study period in reading order', () => {
    const { getByRole } = render(<EducationSection />);
    const group = getByRole('region', { name: 'Education' });
    const entries = within(group).getAllByRole('listitem');
    expect(entries).toHaveLength(3);
    entries.forEach((entry, index) => {
      const item = education[index];
      if (!item) throw new Error('Missing canonical education entry');
      for (const value of [item.institution, item.degree, item.period, item.location]) {
        expect(entry.textContent).toContain(value);
      }
    });
    expect(group.textContent).toContain('expected Dec 2027');
    expect(group.textContent).toContain('online');
  });
});
