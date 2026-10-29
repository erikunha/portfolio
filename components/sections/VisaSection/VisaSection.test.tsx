import { readFileSync } from 'node:fs';
import path from 'node:path';
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

  it('renders each data label as a visible mobile cell prefix', async () => {
    const { container } = render(await VisaContent());
    const labelled = [...container.querySelectorAll('tbody td[data-label]')];
    expect(labelled.length).toBe(visaRows.length * 2);
    // behavioral-test-allow: jsdom does not evaluate ::before content from attr(); the shipped stylesheet is the only carrier
    const css = readFileSync(path.resolve(__dirname, '../../../app/css/components.css'), 'utf-8');
    expect(css).toMatch(/\.visa-table td::before\s*\{[^}]*content:\s*attr\(data-label\)/);
  });
});
