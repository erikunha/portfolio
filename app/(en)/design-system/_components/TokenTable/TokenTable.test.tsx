import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getThemeTokens } from '../../_lib/theme-tokens';
import { ResponsiveTokenTable, RoleTable, TokenTable, ViewportTable } from './TokenTable';

const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.querySelector('.ds-cell-value')?.textContent);

const dataRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);

describe('TokenTable', () => {
  it('prints one row per spacing token with the size theme.css gives it', () => {
    render(
      <TokenTable
        caption="Spacing"
        prefix="spacing-"
        scope="theme"
        utility="{step}"
        valueHeader="Size"
      />,
    );
    const rows = dataRows(screen.getByRole('table'));
    const spacing = getThemeTokens().filter(
      (token) => token.name.startsWith('--spacing-') && token.scope === 'theme',
    );
    expect(rows).toHaveLength(spacing.length);
    expect(cellsOf(rows[0] as HTMLElement)).toEqual(['--spacing-1', '1', '4px']);
    expect(rows.map((row) => cellsOf(row)[0])).toContain('--spacing-target');
  });

  it('fails the build when a named token is not declared', () => {
    expect(() => render(<TokenTable caption="Missing" names={['spacing-99']} />)).toThrow(
      '--spacing-99',
    );
  });

  it('shows the source and the resolved size of a computed token', () => {
    render(<TokenTable caption="Phi" names={['phi-space-2']} source />);
    expect(cellsOf(dataRows(screen.getByRole('table'))[0] as HTMLElement)).toEqual([
      '--phi-space-2',
      'calc(var(--phi-space-1) * var(--phi))',
      '12.94px',
    ]);
  });

  it('orders layers by their stacking value when asked', () => {
    render(<TokenTable caption="Layers" prefix="z-" sortByValue />);
    const values = dataRows(screen.getByRole('table')).map((row) => Number(cellsOf(row)[1]));
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

describe('captions', () => {
  it('names the table region by its caption so two token tables on a page stay distinct', () => {
    render(<TokenTable caption="Spacing tokens" names={['spacing-1']} />);
    expect(screen.getByLabelText('Spacing tokens table with columns Token, Value')).toBeTruthy();
  });
});

describe('RoleTable', () => {
  it('prints the primitive each role aliases', () => {
    render(
      <RoleTable
        caption="Roles"
        names={['surface', 'text']}
        usage={{ surface: 'Page background' }}
      />,
    );
    expect(dataRows(screen.getByRole('table')).map((row) => cellsOf(row))).toEqual([
      ['surface', 'secondary-950', 'Page background'],
      ['text', 'tertiary-50', ''],
    ]);
  });
});

describe('ResponsiveTokenTable', () => {
  it('prints the value below and from the breakpoint', () => {
    render(<ResponsiveTokenTable caption="Page" names={['space-section']} breakpoint="768px" />);
    expect(cellsOf(dataRows(screen.getByRole('table'))[0] as HTMLElement)).toEqual([
      '--space-section',
      '32px',
      '48px',
    ]);
  });
});

describe('ViewportTable', () => {
  it('pairs every step with its below twin', () => {
    render(<ViewportTable caption="Viewports" usage={{}} />);
    expect(cellsOf(dataRows(screen.getByRole('table'))[0] as HTMLElement)).toEqual([
      '--viewport-narrow',
      '360px',
      '359.98px',
      '',
    ]);
  });
});

describe('the token pages', () => {
  // behavioral-test-allow: the MDX source is the only place a hand-copied token row can hide.
  const PAGES = [
    'app/(en)/design-system/tokens/page.mdx',
    'app/(en)/design-system/foundations/spacing-borders/page.mdx',
  ];
  const TOKEN_ROW = /^\|\s*`(--[\w-]+)`\s*\|/gm;

  it.each(PAGES)('%s hand-writes no row for a token theme.css declares', (page) => {
    const declared = new Set(getThemeTokens().map((token) => token.name));
    const source = readFileSync(join(process.cwd(), page), 'utf8');
    const handWritten = [...source.matchAll(TOKEN_ROW)]
      .map((match) => match[1] as string)
      .filter((name) => declared.has(name));
    expect(
      handWritten,
      'render this table with TokenTable so the value comes from theme.css',
    ).toEqual([]);
  });
});
