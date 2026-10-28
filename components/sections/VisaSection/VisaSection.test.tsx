import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { visaRows } from '@/content/visa';
import { VisaContent } from './VisaSection';

vi.mock('@/lib/ua', () => ({ getIsMobile: vi.fn(async () => false) }));

describe('work authorization table', () => {
  it('uses one semantic table with column and row headers for confirmed records', async () => {
    const { container } = render(await VisaContent());
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.querySelector('caption')?.textContent).toContain('Work authorization');
    expect(
      [...container.querySelectorAll('thead th[scope="col"]')].map((th) => th.textContent),
    ).toEqual(['JURISDICTION', 'STATUS', 'EVIDENCE']);
    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(visaRows.length);
    visaRows.forEach((expected, index) => {
      const row = rows[index];
      expect(row?.querySelector('th[scope="row"]')?.textContent).toBe(expected.jurisdiction);
      expect([...(row?.querySelectorAll('td') ?? [])].map((td) => td.textContent)).toEqual([
        expected.status,
        expected.evidence,
      ]);
    });
    expect(container.querySelector('pre')).toBeNull();
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });
});
