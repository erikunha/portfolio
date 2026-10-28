import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

describe('ReadmeSection About compatibility export', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render() {
    const { ReadmeSection } = await import('@/components/sections/ReadmeSection/ReadmeSection');
    mounted = await mountClient(createElement(ReadmeSection));
    return mounted.container;
  }

  it('renders the About heading and preserves the README navigation anchor', async () => {
    const container = await render();
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toContain('About');
    expect(heading?.textContent).toContain('CAT README.MD');
    expect(container.querySelector('#sec-readme')).not.toBeNull();
    expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('renders all thirteen sequential line numbers outside the accessible prose', async () => {
    const container = await render();
    const gutter = container.querySelector('.ab-gutter');
    expect(gutter?.getAttribute('aria-hidden')).toBe('true');
    expect([...(gutter?.querySelectorAll('span') ?? [])].map((line) => line.textContent)).toEqual(
      Array.from({ length: 13 }, (_, index) => String(index + 1)),
    );
  });

  it('renders the five About panels through the compatibility export', async () => {
    const container = await render();
    expect(
      [...container.querySelectorAll('.ab-panel > header h3')].map((title) => title.textContent),
    ).toEqual([
      '# Whoami',
      'CAT ~/.NOW',
      'LS -LA ~/RESPONSIBILITIES',
      'NPM LIST --GLOBAL',
      '$ cat src/lib/with-retry.ts',
    ]);
  });

  it('renders the GitHub link in the code sample block', async () => {
    const container = await render();
    const githubLink = container.querySelector<HTMLAnchorElement>('a[href*="github.com/erikunha"]');
    expect(githubLink).not.toBeNull();
  });

  it('renders the withRetry code sample', async () => {
    const container = await render();
    expect(container.textContent).toContain('withRetry');
  });

  it('renders static Senior status in the Whoami panel without live announcements', async () => {
    const container = await render();
    const role = container.querySelector('.ab-role');
    expect(role?.textContent).toBe('[Senior]');
    expect(role?.closest('.ab-panel')?.querySelector('h3')?.textContent).toBe('# Whoami');
    expect(role?.closest('[aria-hidden="true"]')).toBeNull();
    expect(container.querySelector('[role="status"], [aria-live]')).toBeNull();
  });
});
