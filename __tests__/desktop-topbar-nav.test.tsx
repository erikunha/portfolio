import { act, createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SectionNavigationProvider } from '@/components/responsive/SectionNavigation';
import { NAV_VOCABULARY, TOPBAR_MOTION_LABEL, TOPBAR_NAV } from '@/content/nav';
import { NAVIGATION } from '@/content/navigation';
import { topbarChrome } from '@/content/terminal-chrome';
import { type MountedClient, mountClient } from './helpers/render';

async function renderTopbar(): Promise<MountedClient> {
  const { DesktopTopbar } = await import(
    '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
  );
  return mountClient(createElement(SectionNavigationProvider, null, createElement(DesktopTopbar)));
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
    const hiddenAtWide = ancestors.some((element) =>
      (element.getAttribute('class') ?? '').includes('xl:hidden'),
    );
    expect(
      hiddenAtWide,
      'the brand badge must not disappear at the xl breakpoint: it belongs on the row at every desktop width',
    ).toBe(false);
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
