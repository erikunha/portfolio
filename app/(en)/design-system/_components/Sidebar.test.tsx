import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';

const pathnameState = vi.hoisted(() => ({ current: '/design-system' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.current,
}));

import { DsDrawerNav, PagerNav, Sidebar } from './Sidebar.client';

afterEach(() => {
  pathnameState.current = '/design-system';
});

describe('DsDrawerNav', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  it('is a named navigation inside the one site menu', async () => {
    mounted = await mountClient(createElement(DsDrawerNav));
    const nav = mounted.container.querySelector('nav') as HTMLElement;
    expect(nav.getAttribute('aria-label')).toBe('Design system menu');
  });

  it('lists every design-system page without repeating the home link', async () => {
    mounted = await mountClient(createElement(DsDrawerNav));
    const labels = Array.from(mounted.container.querySelectorAll('a')).map(
      (link) => link.textContent,
    );
    expect(labels).toContain('OVERVIEW');
    expect(labels).toContain('TOKENS');
    expect(labels).toContain('COMPONENTS');
    expect(labels).toContain('WINDOW-CHROME');
    expect(labels).not.toContain('HOME');
  });

  it('marks the current page', async () => {
    pathnameState.current = '/design-system/tokens';
    mounted = await mountClient(createElement(DsDrawerNav));
    const current = Array.from(mounted.container.querySelectorAll('a')).find(
      (link) => link.textContent === 'TOKENS',
    );
    expect(current?.getAttribute('aria-current')).toBe('page');
  });
});

describe('Sidebar rail', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  it('renders the design-system navigation with the home link and page groups', async () => {
    mounted = await mountClient(createElement(Sidebar));
    const nav = mounted.container.querySelector('nav.ds-sidebar') as HTMLElement;
    expect(nav).not.toBeNull();
    expect(nav.getAttribute('aria-label')).toBe('Design system');
    const labels = Array.from(nav.querySelectorAll('a')).map((link) => link.textContent);
    expect(labels).toContain('HOME');
    expect(labels).toContain('OVERVIEW');
    expect(labels).toContain('TOKENS');
    expect(labels).toContain('CHANGELOG');
    expect(labels).toContain('BUTTON');
  });

  it('marks the link of the current page with aria-current', async () => {
    pathnameState.current = '/design-system/tokens';
    mounted = await mountClient(createElement(Sidebar));
    const nav = mounted.container.querySelector('nav.ds-sidebar') as HTMLElement;
    const current = Array.from(nav.querySelectorAll('a')).find(
      (link) => link.textContent === 'TOKENS',
    );
    expect(current?.getAttribute('aria-current')).toBe('page');
    const overview = Array.from(nav.querySelectorAll('a')).find(
      (link) => link.textContent === 'OVERVIEW',
    );
    expect(overview?.hasAttribute('aria-current')).toBe(false);
  });
});

describe('PagerNav', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  it('renders the pager for a page in the documentation chain', async () => {
    pathnameState.current = '/design-system/tokens';
    mounted = await mountClient(createElement(PagerNav));
    const pager = mounted.container.querySelector('nav.pager') as HTMLElement;
    expect(pager).not.toBeNull();
    expect(pager.getAttribute('aria-label')).toBe('Pagination');
  });

  it('renders nothing for a route outside the documentation chain', async () => {
    pathnameState.current = '/design-system/primitives/button';
    mounted = await mountClient(createElement(PagerNav));
    expect(mounted.container.firstChild).toBeNull();
  });

  it('renders the pager on the overview route', async () => {
    pathnameState.current = '/design-system';
    mounted = await mountClient(createElement(PagerNav));
    expect(mounted.container.querySelector('nav.pager')).not.toBeNull();
  });
});
