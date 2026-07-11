import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

let mockPathname = '/design-system';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('Sidebar', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    mockPathname = '/design-system';
  });

  async function render(pathname = '/design-system') {
    mockPathname = pathname;
    const { Sidebar } = await import('@/app/design-system/_components/Sidebar.client');
    mounted = await mountClient(createElement(Sidebar));
    return mounted.container;
  }

  it('renders the HOME back-link pointing to /', async () => {
    const container = await render();
    const homeLink = container.querySelector<HTMLAnchorElement>('a[href="/"]');
    expect(homeLink).not.toBeNull();
    expect(homeLink?.textContent).toContain('HOME');
  });

  it('renders links for all design-system sections', async () => {
    const container = await render();
    const links = container.querySelectorAll<HTMLAnchorElement>('a[href^="/design-system"]');
    expect(links.length).toBeGreaterThanOrEqual(5);
  });

  it('marks the current page link with aria-current="page"', async () => {
    const container = await render('/design-system/tokens');
    const active = container.querySelector('[aria-current="page"]');
    expect(active).not.toBeNull();
    expect((active as HTMLAnchorElement)?.getAttribute('href')).toBe('/design-system/tokens');
  });

  it('does not set aria-current on non-active links', async () => {
    const container = await render('/design-system');
    const nonActive = container.querySelectorAll(
      'a[href^="/design-system"]:not([aria-current="page"])',
    );
    expect(nonActive.length).toBeGreaterThan(0);
    nonActive.forEach((link) => {
      expect(link.getAttribute('aria-current')).toBeNull();
    });
  });

  it('renders a nav with design system aria-label', async () => {
    const container = await render();
    const nav = container.querySelector('nav[aria-label="Design system"]');
    expect(nav).not.toBeNull();
  });
});
