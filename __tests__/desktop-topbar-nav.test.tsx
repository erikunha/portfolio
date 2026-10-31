import { act, createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SectionNavigationProvider } from '@/components/responsive/SectionNavigation';
import { NAV_VOCABULARY, TOPBAR_MOTION_LABEL, TOPBAR_NAV } from '@/content/nav';
import { NAVIGATION } from '@/content/navigation';
import { topbarChrome } from '@/content/terminal-chrome';
import { type MountedClient, mountClient } from './helpers/render';

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
  return mountClient(createElement(SectionNavigationProvider, null, createElement(DesktopTopbar)));
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
  });

  it('names every destination in the shared vocabulary, once', async () => {
    mounted = await renderTopbar();
    const nav = mounted.container.querySelector('nav[aria-label="Site navigation"]');
    const labels = [...(nav?.querySelectorAll('a') ?? [])].map((link) =>
      (link.textContent ?? '').replace(NAVIGATION.copy.newTabSuffix, ''),
    );

    expect(labels).toEqual([
      NAV_VOCABULARY.about,
      NAV_VOCABULARY.work,
      NAV_VOCABULARY.career,
      NAV_VOCABULARY.contact,
      NAV_VOCABULARY.designSystem,
      'VIEW_CV',
      NAV_VOCABULARY.hire,
    ]);
  });

  it('links every section shortcut at its root-relative section', async () => {
    mounted = await renderTopbar();
    const nav = mounted.container.querySelector('nav[aria-label="Site navigation"]');
    const hrefs = [...(nav?.querySelectorAll('a') ?? [])].map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual([
      '/#sec-readme',
      '/#sec-projects',
      '/#sec-git-log',
      '/#sec-contact',
      '/design-system',
      '/cv',
      'https://www.linkedin.com/in/erikunha/',
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

    expect(shortcut?.textContent).toBe(
      /mac/i.test(navigator.platform)
        ? NAVIGATION.copy.searchShortcutApple
        : NAVIGATION.copy.searchShortcutOther,
    );
  });

  it('keeps the hire CTA on LinkedIn and names the new tab for assistive tech', async () => {
    mounted = await renderTopbar();
    const hire = [...mounted.container.querySelectorAll('a')].find((link) =>
      link.textContent?.startsWith(NAV_VOCABULARY.hire),
    );

    expect(hire?.getAttribute('href')).toBe('https://www.linkedin.com/in/erikunha/');
    expect(hire?.getAttribute('target')).toBe('_blank');
    expect(hire?.getAttribute('rel')).toContain('noopener');
    expect(hire?.textContent).toContain(NAVIGATION.copy.newTabSuffix);
    expect(hire?.hasAttribute('aria-label'), 'the visible label stays in the accessible name').toBe(
      false,
    );
  });

  it('keeps the brand badge on the row at every desktop width', async () => {
    mounted = await renderTopbar();
    const label = [...mounted.container.querySelectorAll('span')].find(
      (span) => span.textContent === topbarChrome.brandLabel,
    );

    expect(label, 'the brand badge must be part of the topbar').not.toBeNull();

    const ancestors = [];
    for (let node = label?.parentElement ?? null; node; node = node.parentElement) {
      ancestors.push(node);
    }

    for (const width of DESKTOP_WIDTHS) {
      const hiddenAt = ancestors.filter((element) =>
        isHiddenAtWidth(element.getAttribute('class') ?? '', width),
      );
      expect(
        hiddenAt.map((element) => element.getAttribute('class') ?? ''),
        `the brand badge must be visible at ${width}px: an ancestor that hides it takes the badge off the row`,
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
      NAV_VOCABULARY.designSystem,
    ]);
    expect(links.slice(0, TOPBAR_NAV.length).map((link) => link.textContent)).toEqual(
      TOPBAR_NAV.map(({ label }) => label),
    );
  });
});
