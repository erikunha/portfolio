import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionNavigationProvider } from '@/components/responsive/SectionNavigation';
import {
  HIRE_ACCESSIBLE_NAME,
  HIRE_SHORT_LABEL,
  NAV_VOCABULARY,
  TOPBAR_MOTION_LABEL,
  TOPBAR_NAV,
} from '@/content/nav';
import { NAVIGATION } from '@/content/navigation';
import { type MountedClient, mountClient } from './helpers/render';

let mockPathname: string | null = null;

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

const DESKTOP_WIDTHS = [768, 1024, 1280, 1440];
const BREAKPOINT_MIN_WIDTH: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};
const DISPLAY_UTILITIES = new Set([
  'block',
  'contents',
  'flow-root',
  'flex',
  'grid',
  'inline',
  'inline-block',
  'inline-flex',
  'inline-grid',
  'inline-table',
  'list-item',
  'table',
]);

async function renderTopbar(): Promise<MountedClient> {
  const { DesktopTopbar } = await import(
    '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
  );
  return mountClient(
    createElement(
      SectionNavigationProvider,
      null,
      createElement(DesktopTopbar, {
        brand: createElement('a', { href: '/', 'data-test-brand': '1' }, 'brand'),
      }),
    ),
  );
}

function isHiddenAtWidth(className: string, width: number): boolean {
  const classes = className.split(/\s+/).filter(Boolean);
  let hidden = classes.includes('hidden');
  for (const [breakpoint, minWidth] of Object.entries(BREAKPOINT_MIN_WIDTH).sort(
    (a, b) => a[1] - b[1],
  )) {
    if (minWidth > width) continue;
    for (const token of classes) {
      if (!token.startsWith(`${breakpoint}:`)) continue;
      const utility = token.slice(breakpoint.length + 1);
      if (utility === 'hidden') hidden = true;
      else if (DISPLAY_UTILITIES.has(utility)) hidden = false;
    }
  }
  return hidden;
}

describe('DesktopTopbar', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    mockPathname = null;
  });

  it('names every destination in the shared vocabulary, once', async () => {
    mounted = await renderTopbar();
    const nav = mounted.container.querySelector('nav[aria-label="Site navigation"]');
    const labels = [...(nav?.querySelectorAll('a') ?? [])].map((link) =>
      (link.textContent ?? '').trim(),
    );

    expect(labels).toEqual([
      'VIEW_CV',
      HIRE_SHORT_LABEL,
      NAV_VOCABULARY.about,
      NAV_VOCABULARY.work,
      NAV_VOCABULARY.career,
      NAV_VOCABULARY.contact,
      NAV_VOCABULARY.links,
      NAV_VOCABULARY.designSystem,
    ]);
  });

  it('links every section shortcut at its root-relative section', async () => {
    mounted = await renderTopbar();
    const nav = mounted.container.querySelector('nav[aria-label="Site navigation"]');
    const hrefs = [...(nav?.querySelectorAll('a') ?? [])].map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual([
      '/cv',
      'https://www.linkedin.com/in/erikunha/',
      '/#sec-readme',
      '/#sec-projects',
      '/#sec-git-log',
      '/#sec-contact',
      '/links',
      '/design-system',
    ]);
  });

  it('carries a search trigger that opens the section drawer until the palette ships', async () => {
    mounted = await renderTopbar();
    const trigger = mounted.container.querySelector('.topbar-search') as HTMLButtonElement;

    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute('aria-keyshortcuts')).toBe('Control+K Meta+K');
    expect(trigger.getAttribute('aria-controls')).toBe('section-drawer');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent).toContain(NAVIGATION.copy.searchLabel);

    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('offers the search shortcut the platform uses', async () => {
    mounted = await renderTopbar();
    const shortcut = mounted.container.querySelector('.search-trigger-shortcut');
    const expected = /mac/i.test(navigator.platform) ? 'apple' : 'other';

    expect(shortcut?.getAttribute('data-keyboard')).toBe(expected);
    expect(shortcut?.querySelector(`[data-platform="${expected}"]`)?.textContent).toBe(
      expected === 'apple'
        ? NAVIGATION.copy.searchShortcutApple
        : NAVIGATION.copy.searchShortcutOther,
    );
    expect(
      shortcut?.textContent,
      'the server HTML carries both labels, so the slot reserves its width before hydration',
    ).toContain(NAVIGATION.copy.searchShortcutApple);
    expect(shortcut?.textContent).toContain(NAVIGATION.copy.searchShortcutOther);
  });

  it('keeps the hire CTA on LinkedIn and names the new tab for assistive tech', async () => {
    mounted = await renderTopbar();
    const hire = [...mounted.container.querySelectorAll('a')].find((link) =>
      link.textContent?.startsWith(HIRE_SHORT_LABEL),
    );

    expect(hire?.getAttribute('href')).toBe('https://www.linkedin.com/in/erikunha/');
    expect(hire?.getAttribute('target')).toBe('_blank');
    expect(hire?.getAttribute('rel')).toContain('noopener');
    expect(hire?.textContent?.trim()).toBe(HIRE_SHORT_LABEL);
    expect(hire?.getAttribute('aria-label')).toBe(HIRE_ACCESSIBLE_NAME);
  });

  it('puts the menu trigger first and the brand last, in DOM order and so in focus order', async () => {
    mounted = await renderTopbar();
    const focusable = [...mounted.container.querySelectorAll<HTMLElement>('a[href], button')];
    const brandLink = focusable.find((element) => element.getAttribute('data-test-brand') === '1');
    const trigger = mounted.container.querySelector<HTMLElement>('.menu-trigger');
    const hire = focusable.find((element) =>
      element.getAttribute('href')?.startsWith('https://www.linkedin.com'),
    );

    expect(brandLink, 'the brand slot must render at the right of the topbar').toBeDefined();
    expect(trigger, 'the menu trigger must be part of the topbar').not.toBeNull();
    expect(focusable[0], 'the menu trigger is the first focus stop').toBe(trigger);
    expect(focusable.at(-1), 'the brand is the last focus stop').toBe(brandLink);
    expect(
      hire && trigger && trigger.compareDocumentPosition(hire) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the HIRE link must follow the menu trigger',
    ).toBeTruthy();
  });

  it('draws no window dots in the topbar', async () => {
    mounted = await renderTopbar();

    expect(mounted.container.querySelector('.window-chrome, [data-dot]')).toBeNull();
  });

  it('keeps the menu trigger on the row at every desktop width', async () => {
    mounted = await renderTopbar();
    const trigger = mounted.container.querySelector('.menu-trigger');
    const ancestors = [];
    for (let node = trigger?.parentElement ?? null; node; node = node.parentElement) {
      ancestors.push(node);
    }

    for (const width of DESKTOP_WIDTHS) {
      const hiddenAt = ancestors.filter((element) =>
        isHiddenAtWidth(element.getAttribute('class') ?? '', width),
      );
      expect(
        hiddenAt.map((element) => element.getAttribute('class') ?? ''),
        `the menu trigger must be visible at ${width}px`,
      ).toEqual([]);
    }
  });

  it('hides VIEW_CV and the hire link below the lg tier', async () => {
    mounted = await renderTopbar();
    const nav = mounted.container.querySelector('nav[aria-label="Site navigation"]');
    const links = [...(nav?.querySelectorAll('a') ?? [])];
    const cv = links.find((link) => link.getAttribute('href') === '/cv');
    const hire = links.find((link) =>
      link.getAttribute('href')?.startsWith('https://www.linkedin.com'),
    );

    expect(cv, 'VIEW_CV must stay on the topbar, hidden or visible').not.toBeNull();
    expect(hire, 'the hire link must stay on the topbar, hidden or visible').not.toBeNull();

    for (const width of DESKTOP_WIDTHS) {
      const expectedHidden = width < 1024;
      expect(
        isHiddenAtWidth(cv?.getAttribute('class') ?? '', width),
        `VIEW_CV must be ${expectedHidden ? 'hidden' : 'visible'} at ${width}px`,
      ).toBe(expectedHidden);
      expect(
        isHiddenAtWidth(hire?.getAttribute('class') ?? '', width),
        `the hire link must be ${expectedHidden ? 'hidden' : 'visible'} at ${width}px`,
      ).toBe(expectedHidden);
    }
  });

  it('spells the motion control compact and leaves the state on the button', async () => {
    mounted = await renderTopbar();
    const button = mounted.container.querySelector('button[aria-pressed]') as HTMLButtonElement;

    expect(button).not.toBeNull();
    expect(button.textContent).toContain(TOPBAR_MOTION_LABEL);
    expect(button.textContent).not.toContain(NAVIGATION.copy.motionOn);
    expect(button.getAttribute('aria-pressed'), 'the state rides on aria-pressed').toBe('true');

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('serves the same section shortcuts the content declares', async () => {
    mounted = await renderTopbar();
    const nav = mounted.container.querySelector('nav[aria-label="Site navigation"]');
    const links = [...(nav?.querySelectorAll('a') ?? [])];

    expect(TOPBAR_NAV.map(({ label }) => label)).toEqual([
      NAV_VOCABULARY.about,
      NAV_VOCABULARY.work,
      NAV_VOCABULARY.career,
      NAV_VOCABULARY.contact,
      NAV_VOCABULARY.links,
      NAV_VOCABULARY.designSystem,
    ]);
    expect(links.slice(-TOPBAR_NAV.length).map((link) => link.textContent)).toEqual(
      TOPBAR_NAV.map(({ label }) => label),
    );
  });

  const currentLabels = () =>
    [
      ...mounted.container.querySelectorAll(
        'nav[aria-label="Site navigation"] a[aria-current="page"]',
      ),
    ].map((link) => (link.textContent ?? '').trim());

  it.each([
    ['/design-system', NAV_VOCABULARY.designSystem],
    ['/design-system/tokens', NAV_VOCABULARY.designSystem],
    ['/links', NAV_VOCABULARY.links],
    ['/links/en', NAV_VOCABULARY.links],
  ])('marks only the page link current on %s', async (path, label) => {
    mockPathname = path;
    mounted = await renderTopbar();
    expect(currentLabels()).toEqual([label]);
  });

  it.each(['/', '/design-systems', '/linksfoo', null])(
    'marks no page link current on %s',
    async (path) => {
      mockPathname = path;
      mounted = await renderTopbar();
      expect(currentLabels()).toEqual([]);
    },
  );
});
