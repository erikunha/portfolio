import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { responsibilities } from '@/content/responsibilities';

async function renderAbout() {
  const { AboutSection } = await import('./AboutSection');
  return render(<AboutSection />);
}

describe('About panel group', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders panels in reading order under one About heading', async () => {
    const { getByRole, getAllByRole } = await renderAbout();
    expect(getByRole('heading', { level: 2, name: 'ABOUT CAT README.MD' })).toBeDefined();
    expect(
      getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent?.replace('▌', '')),
    ).toEqual([
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
  it('keeps line numbers decorative and highlights Senior without a live region', async () => {
    const { container, getByText } = await renderAbout();
    const gutter = container.querySelector('.about-line-numbers');
    expect(gutter?.getAttribute('aria-hidden')).toBe('true');
    expect(gutter?.textContent).toContain('13');
    expect(getByText('[Senior]').closest('[aria-hidden="true"], [aria-live]')).toBeNull();
  });

  it('shows the current work without repeating identity or authorization enums', async () => {
    const { container, getByText } = await renderAbout();
    expect(
      getByText('building the investor workflow frontend at Raylu · private-markets fintech'),
    ).toBeDefined();
    expect(container.textContent).not.toContain('NEEDS_SPONSORSHIP');
    expect(container.textContent).not.toContain('Senior Software Engineer, Frontend & Product.');
  });

  it('provides a COPY control and preserves the complete syntax-colored source', async () => {
    const { getByRole } = await renderAbout();
    const { retryCode } = await import('@/content/readme');
    expect(getByRole('button', { name: 'COPY' }).closest('header')).not.toBeNull();
    const region = getByRole('region', { name: retryCode.regionLabel });
    expect(region.textContent).toBe(retryCode.source);
    expect(region.querySelector('.about-code-keyword')).not.toBeNull();
  });
  it('copies the retry source and announces the result through the existing control', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { getByRole } = await renderAbout();
    const { retryCode } = await import('@/content/readme');
    await act(async () => fireEvent.click(getByRole('button', { name: 'COPY' })));
    expect(writeText).toHaveBeenCalledWith(retryCode.source);
    expect(getByRole('button', { name: 'COPIED' })).toBeDefined();
    expect(getByRole('status').textContent).toBe('Copied to clipboard.');
  });
});
