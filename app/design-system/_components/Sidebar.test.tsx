import { fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';

const pathnameState = vi.hoisted(() => ({ current: '/design-system' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.current,
}));

import { DS_DRAWER_ID } from './ds-nav';
import { PagerNav, Sidebar, SiteBar } from './Sidebar.client';

function drawer(): HTMLElement {
  return document.getElementById(DS_DRAWER_ID) as HTMLElement;
}

function menuTrigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('.site-bar-menu') as HTMLButtonElement;
}

afterEach(() => {
  pathnameState.current = '/design-system';
});

describe('SiteBar topbar', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function renderSiteBar(): Promise<HTMLElement> {
    mounted = await mountClient(createElement(SiteBar));
    return mounted.container;
  }

  it('renders the brand link pointing at the home route', async () => {
    const container = await renderSiteBar();
    const brand = container.querySelector('.site-bar-brand') as HTMLAnchorElement;
    expect(brand).not.toBeNull();
    expect(brand.getAttribute('href')).toBe('/');
    expect(brand.textContent).toBe('erik_cunha.sh');
  });

  it('renders the site navigation and marks DESIGN_SYSTEM as current', async () => {
    const container = await renderSiteBar();
    const nav = container.querySelector('.site-bar-nav') as HTMLElement;
    expect(nav).not.toBeNull();
    expect(nav.getAttribute('aria-label')).toBe('Site navigation');
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((link) => link.textContent)).toEqual([
      'ABOUT',
      'WORK',
      'CAREER',
      'CONTACT',
      'DESIGN_SYSTEM',
    ]);
    const current = links.find((link) => link.textContent === 'DESIGN_SYSTEM');
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(
      links
        .filter((link) => link.textContent !== 'DESIGN_SYSTEM')
        .every((link) => !link.hasAttribute('aria-current')),
    ).toBe(true);
  });

  it('marks DESIGN_SYSTEM as current on nested design-system routes', async () => {
    pathnameState.current = '/design-system/tokens';
    const container = await renderSiteBar();
    const nav = container.querySelector('.site-bar-nav') as HTMLElement;
    const current = Array.from(nav.querySelectorAll('a')).find(
      (link) => link.textContent === 'DESIGN_SYSTEM',
    );
    expect(current?.getAttribute('aria-current')).toBe('page');
  });
});

describe('SiteBar mobile drawer', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    document.body.style.overflow = '';
  });

  async function renderSiteBar(): Promise<HTMLElement> {
    mounted = await mountClient(createElement(SiteBar));
    return mounted.container;
  }

  it('starts closed with the trigger reporting aria-expanded=false', async () => {
    const container = await renderSiteBar();
    const trigger = menuTrigger(container);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(DS_DRAWER_ID);
    expect(drawer().getAttribute('aria-hidden')).toBe('true');
    expect(drawer().classList.contains('is-open')).toBe(false);
  });

  it('opens the drawer when the MENU trigger is activated', async () => {
    const container = await renderSiteBar();
    fireEvent.click(menuTrigger(container));
    expect(menuTrigger(container).getAttribute('aria-expanded')).toBe('true');
    expect(drawer().classList.contains('is-open')).toBe(true);
    expect(drawer().getAttribute('aria-hidden')).toBe('false');
  });

  it('isolates the open drawer as a modal and releases the page on close', async () => {
    const page = document.createElement('main');
    document.body.appendChild(page);
    const container = await renderSiteBar();
    const trigger = menuTrigger(container);
    fireEvent.click(trigger);
    expect(drawer().getAttribute('role')).toBe('dialog');
    expect(drawer().getAttribute('aria-modal')).toBe('true');
    expect(page.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('.site-bar')?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('.site-scrim')?.hasAttribute('inert')).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(drawer().hasAttribute('role')).toBe(false);
    expect(page.hasAttribute('inert')).toBe(false);
    expect(container.querySelector('.site-bar')?.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(trigger);
    page.remove();
  });

  it('moves focus into the drawer when it opens', async () => {
    const container = await renderSiteBar();
    fireEvent.click(menuTrigger(container));
    const closeButton = drawer().querySelector('.site-drawer-close') as HTMLButtonElement;
    expect(document.activeElement).toBe(closeButton);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const container = await renderSiteBar();
    const trigger = menuTrigger(container);
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(drawer().classList.contains('is-open')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on scrim click and returns focus to the trigger', async () => {
    const container = await renderSiteBar();
    const trigger = menuTrigger(container);
    fireEvent.click(trigger);
    const scrim = container.querySelector('.site-scrim') as HTMLElement;
    fireEvent.click(scrim);
    expect(drawer().classList.contains('is-open')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when a drawer link is activated and returns focus to the trigger', async () => {
    const container = await renderSiteBar();
    const trigger = menuTrigger(container);
    fireEvent.click(trigger);
    const tokensLink = Array.from(drawer().querySelectorAll('a')).find(
      (link) => link.textContent === 'TOKENS',
    ) as HTMLAnchorElement;
    fireEvent.click(tokensLink);
    expect(drawer().classList.contains('is-open')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes via its close button and returns focus to the trigger', async () => {
    const container = await renderSiteBar();
    const trigger = menuTrigger(container);
    fireEvent.click(trigger);
    const closeButton = drawer().querySelector('.site-drawer-close') as HTMLButtonElement;
    fireEvent.click(closeButton);
    expect(drawer().classList.contains('is-open')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('renders the design-system navigation groups inside the drawer', async () => {
    const container = await renderSiteBar();
    fireEvent.click(menuTrigger(container));
    const labels = Array.from(drawer().querySelectorAll('a')).map((link) => link.textContent);
    expect(labels).toContain('HOME');
    expect(labels).toContain('OVERVIEW');
    expect(labels).toContain('TOKENS');
    expect(labels).toContain('COMPONENTS');
    expect(labels).toContain('ENFORCEMENT');
    expect(labels).toContain('CHANGELOG');
  });

  it('keeps the closed drawer out of the tab order', async () => {
    await renderSiteBar();
    expect(drawer().hasAttribute('inert')).toBe(true);
  });

  it('wraps Tab from the last drawer link back to the close button', async () => {
    const container = await renderSiteBar();
    fireEvent.click(menuTrigger(container));
    expect(drawer().hasAttribute('inert')).toBe(false);
    const focusables = drawer().querySelectorAll<HTMLElement>('a, button');
    focusables[focusables.length - 1]?.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);
  });

  it('wraps Shift+Tab from the close button to the last drawer link', async () => {
    const container = await renderSiteBar();
    fireEvent.click(menuTrigger(container));
    const focusables = drawer().querySelectorAll<HTMLElement>('a, button');
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  });

  it('locks body scroll while open and restores it on close', async () => {
    const container = await renderSiteBar();
    fireEvent.click(menuTrigger(container));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('');
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
