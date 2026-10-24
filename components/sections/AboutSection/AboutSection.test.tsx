import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { responsibilities } from '@/content/responsibilities';

async function renderAbout() {
  const { AboutSection } = await import('./AboutSection');
  return render(<AboutSection />);
}

describe('About panel group', () => {
  it('renders panels in reading order under one About heading', async () => {
    const { getByRole, getAllByRole } = await renderAbout();
    expect(getByRole('heading', { level: 2, name: 'About' })).toBeDefined();
    expect(getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      '# Whoami',
      'CAT ~/.NOW',
      'LS -LA ~/RESPONSIBILITIES',
      'NPM LIST --GLOBAL',
      '$ cat src/lib/with-retry.ts',
    ]);
  });

  it('groups the stack and displays Storybook and TanStack', async () => {
    const { getByText, queryByText } = await renderAbout();
    for (const group of ['CORE', 'ANGULAR', 'LANG_DATA', 'QUALITY', 'TOOLING']) {
      expect(getByText(group, { selector: 'dt' })).toBeDefined();
    }
    expect(getByText('STORYBOOK')).toBeDefined();
    expect(getByText('TANSTACK')).toBeDefined();
    expect(queryByText('GIT', { exact: true })).toBeNull();
    expect(queryByText('BIOME', { exact: true })).toBeNull();
  });

  it('exposes retry pseudocode as a named keyboard-focusable scroll region', async () => {
    const { getByRole } = await renderAbout();
    const retry = getByRole('region', { name: 'README code' });
    expect(retry.getAttribute('tabindex')).toBe('0');
    expect(retry.textContent).toContain('withRetry');
    expect(retry.textContent).toContain('isFatal');
    expect(retry.closest('[hidden], [aria-hidden="true"]')).toBeNull();
  });

  it('includes all seven complete responsibility names', async () => {
    const { getByText } = await renderAbout();
    for (const row of responsibilities) expect(getByText(row.name)).toBeDefined();
  });
});
