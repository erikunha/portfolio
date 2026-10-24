import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { credentials } from '@/content/credentials';
import { education } from '@/content/education';
import { CredentialsSection } from './CredentialsSection';

describe('Certifications group', () => {
  it('renders only the three canonical certifications, with no MBA, diploma or university', () => {
    const { getByRole } = render(<CredentialsSection embedded />);
    const group = getByRole('region', { name: 'Certifications' });
    const rows = within(group).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    rows.forEach((row, index) => {
      const item = credentials[index];
      if (!item) throw new Error('Missing canonical certification');
      for (const value of [item.label, item.badge, item.evidence]) {
        expect(row.textContent).toContain(value);
      }
    });
    for (const item of education) {
      expect(group.textContent).not.toContain(item.institution);
      expect(group.textContent).not.toContain(item.degree);
    }
    expect(group.textContent).not.toMatch(/MBA|university/i);
  });
});
