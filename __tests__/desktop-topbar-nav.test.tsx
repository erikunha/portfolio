import { act, createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionNavigationProvider } from '@/components/responsive/SectionNavigation';
import {
  HIRE_ACCESSIBLE_NAME,
  HIRE_SHORT_LABEL,
  NAV_VOCABULARY,
  TOPBAR_MOTION_LABEL,
  TOPBAR_NAV,
} from '@/content/nav';
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
import { localizedSectionLabel, SECTION_ID } from '@/content/section-registry';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { type MountedClient, mountClient } from './helpers/render';
import { isHiddenAtWidth } from './helpers/tailwind-visibility';

let mockPathname: string | null = null;
let pathnameSuspended = false;

vi.mock('next/navigation', () => ({
  usePathname: () => {
    if (pathnameSuspended) throw new Promise(() => undefined);
    return mockPathname;
  },
}));

const DESKTOP_WIDTHS = [768, 1024, 1280, 1440];

async function renderTopbar(locale: SiteLocale = SITE_LOCALE.en): Promise<MountedClient> {
  const { DesktopTopbar } = await import(
    '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
  );
  return mountClient(
    createElement(
      SectionNavigationProvider,
      { chrome: siteNavChrome(locale), locale },
      createElement(DesktopTopbar, {
        brand: createElement('a', { href: '/', 'data-test-brand': '1' }, 'brand'),
      }),
    ),
  );
}

describe('DesktopTopbar', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    mockPathname = null;
    pathnameSuspended = false;
  });

  it('names every destination in the shared vocabulary, once', async () => {
    mounted = await renderTopbar();
    const nav = mounted.container.querySelector('nav[aria-label="Site navigation"]');
    const labels = [...(nav?.querySelectorAll('a') ?? [])].map((link) =>
      (link.textContent ?? '').trim(),
    );

    expect(labels).toEqual([
      NAV_VOCABULARY[SITE_LOCALE.en].about,
      NAV_VOCABULARY[SITE_LOCALE.en].work,
      NAV_VOCABULARY[SITE_LOCALE.en].career,
      NAV_VOCABULARY[SITE_LOCALE.en].contact,
      NAV_VOCABULARY[SITE_LOCALE.en].links,
      NAV_VOCABULARY[SITE_LOCALE.en].designSystem,
      'VIEW_CV',
      HIRE_SHORT_LABEL[SITE_LOCALE.en],
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
      '/links/en',
      '/design-system',
      '/cv',
      'https://www.linkedin.com/in/erikunha/',
    ]);
  });

  it('carries no search trigger', async () => {
    mounted = await renderTopbar();

    expect(mounted.container.querySelector('.topbar-search')).toBeNull();
    expect(mounted.container.querySelector('.search-trigger')).toBeNull();
    expect(mounted.container.querySelector('[aria-keyshortcuts]')).toBeNull();
  });

  it('keeps the hire CTA on LinkedIn and names the new tab for assistive tech', async () => {
    mounted = await renderTopbar();
    const hire = [...mounted.container.querySelectorAll('a')].find((link) =>
      link.textContent?.startsWith(HIRE_SHORT_LABEL[SITE_LOCALE.en]),
    );

    expect(hire?.getAttribute('href')).toBe('https://www.linkedin.com/in/erikunha/');
    expect(hire?.getAttribute('target')).toBe('_blank');
    expect(hire?.getAttribute('rel')).toContain('noopener');
    expect(hire?.textContent?.trim()).toBe(HIRE_SHORT_LABEL[SITE_LOCALE.en]);
    expect(hire?.getAttribute('aria-label')).toBe(HIRE_ACCESSIBLE_NAME[SITE_LOCALE.en]);
  });

  it('orders focus stops menu, links, motion, VIEW_CV, HIRE, language switch, brand', async () => {
    mockPathname = '/';
    mounted = await renderTopbar();
    const focusable = [...mounted.container.querySelectorAll<HTMLElement>('a[href], button')];
    const stops = focusable.map((element) => {
      if (element.getAttribute('data-test-brand') === '1') return 'brand';
      if (element.classList.contains('menu-trigger')) return 'menu';
      if (element.closest('[data-lang-switch]')) return 'lang';
      if (element.hasAttribute('aria-pressed')) return 'motion';
      const href = element.getAttribute('href') ?? '';
      if (href === '/cv') return 'cv';
      if (href.startsWith('https://www.linkedin.com')) return 'hire';
      return 'link';
    });

    const reordered = [...mounted.container.querySelectorAll<HTMLElement>('*')].filter(
      (element) =>
        /(^|\s|:)-?order-/.test(element.getAttribute('class') ?? '') || element.style.order !== '',
    );
    expect(reordered, 'no CSS order may reshuffle the topbar').toEqual([]);
    expect(stops, 'DOM order is the visual order and the tab order').toEqual([
      'menu',
      'link',
      'link',
      'link',
      'link',
      'link',
      'link',
      'motion',
      'cv',
      'hire',
      'lang',
      'lang',
      'brand',
    ]);
  });

  it('keeps the language switch on the row at every desktop width, beside the brand group', async () => {
    mockPathname = '/';
    mounted = await renderTopbar();
    const switchNav = mounted.container.querySelector('nav[data-lang-switch]');
    const links = [...(switchNav?.querySelectorAll('a') ?? [])];

    expect(switchNav?.getAttribute('aria-label')).toBe(
      NAVIGATION[SITE_LOCALE.en].copy.langSwitchLabel,
    );
    expect(links.map((link) => link.getAttribute('hreflang'))).toEqual(['en', 'pt']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/pt']);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual(['page', null]);

    const ancestors = [];
    for (let node = switchNav as HTMLElement | null; node; node = node.parentElement) {
      ancestors.push(node);
    }
    for (const width of DESKTOP_WIDTHS) {
      const hiddenAt = ancestors.filter((element) =>
        isHiddenAtWidth(element.getAttribute('class') ?? '', width),
      );
      expect(
        hiddenAt.map((element) => element.getAttribute('class') ?? ''),
        `the language switch must be visible at ${width}px`,
      ).toEqual([]);
    }
  });

  it('marks the Portuguese link current and points back at English on /pt', async () => {
    mockPathname = '/pt';
    mounted = await renderTopbar(SITE_LOCALE.pt);
    const links = [...mounted.container.querySelectorAll('nav[data-lang-switch] a')];

    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/pt']);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page']);
  });

  it('keeps the language switch where the page has no counterpart, pointing the other language home', async () => {
    mockPathname = '/design-system';
    mounted = await renderTopbar();
    const links = [...mounted.container.querySelectorAll('nav[data-lang-switch] a')];

    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/design-system', '/pt']);
  });

  it('is the page banner landmark', async () => {
    mounted = await renderTopbar();
    const bar = mounted.container.querySelector('.desktop-topbar');

    expect(bar?.tagName).toBe('HEADER');
    expect(bar?.parentElement?.closest('main, article, section, aside, nav')).toBeNull();
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

    expect(cv, 'VIEW_CV must stay on the topbar, hidden or visible').toBeDefined();
    expect(hire, 'the hire link must stay on the topbar, hidden or visible').toBeDefined();

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
    expect(button.textContent).toBe(TOPBAR_MOTION_LABEL);
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

    expect(TOPBAR_NAV[SITE_LOCALE.en].map(({ label }) => label)).toEqual([
      NAV_VOCABULARY[SITE_LOCALE.en].about,
      NAV_VOCABULARY[SITE_LOCALE.en].work,
      NAV_VOCABULARY[SITE_LOCALE.en].career,
      NAV_VOCABULARY[SITE_LOCALE.en].contact,
      NAV_VOCABULARY[SITE_LOCALE.en].links,
      NAV_VOCABULARY[SITE_LOCALE.en].designSystem,
    ]);
    expect(
      links.slice(0, TOPBAR_NAV[SITE_LOCALE.en].length).map((link) => link.textContent),
    ).toEqual(TOPBAR_NAV[SITE_LOCALE.en].map(({ label }) => label));
  });

  const currentLabels = () =>
    [
      ...mounted.container.querySelectorAll(
        'nav[aria-label="Site navigation"] a[aria-current="page"]',
      ),
    ].map((link) => (link.textContent ?? '').trim());

  it.each([
    ['/design-system', NAV_VOCABULARY[SITE_LOCALE.en].designSystem],
    ['/design-system/tokens', NAV_VOCABULARY[SITE_LOCALE.en].designSystem],
    ['/links', NAV_VOCABULARY[SITE_LOCALE.en].links],
    ['/links/en', NAV_VOCABULARY[SITE_LOCALE.en].links],
  ])('marks only the page link current on %s', async (path, label) => {
    mockPathname = path;
    mounted = await renderTopbar();
    expect(currentLabels()).toEqual([label]);
  });

  it.each([
    ['/links', NAV_VOCABULARY[SITE_LOCALE.en].links],
    ['/design-system', NAV_VOCABULARY[SITE_LOCALE.en].designSystem],
  ])(
    'ships the page link of %s as current in the server HTML, before the pathname resolves',
    async (route, label) => {
      pathnameSuspended = true;
      const { DesktopTopbar } = await import(
        '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
      );
      const host = document.createElement('div');
      host.innerHTML = renderToString(
        createElement(
          SectionNavigationProvider,
          { chrome: siteNavChrome(SITE_LOCALE.en), locale: SITE_LOCALE.en, route },
          createElement(DesktopTopbar, { brand: createElement('a', { href: '/' }, 'brand') }),
        ),
      );
      const current = [
        ...host.querySelectorAll('nav[aria-label="Site navigation"] a[aria-current="page"]'),
      ].map((link) => (link.textContent ?? '').trim());

      expect(
        current,
        'a visitor without JavaScript never gets the client pass that sets aria-current, so the server HTML has to carry it',
      ).toEqual([label]);
    },
  );

  it.each(['/', '/design-systems', '/linksfoo', null])(
    'marks no page link current on %s',
    async (path) => {
      mockPathname = path;
      mounted = await renderTopbar();
      expect(currentLabels()).toEqual([]);
    },
  );
});

describe('one name per section', () => {
  it.each([
    [SITE_LOCALE.en, 'about', SECTION_ID.about],
    [SITE_LOCALE.en, 'work', SECTION_ID.projects],
    [SITE_LOCALE.en, 'career', SECTION_ID.career],
    [SITE_LOCALE.en, 'contact', SECTION_ID.contact],
    [SITE_LOCALE.pt, 'about', SECTION_ID.about],
    [SITE_LOCALE.pt, 'work', SECTION_ID.projects],
    [SITE_LOCALE.pt, 'career', SECTION_ID.career],
    [SITE_LOCALE.pt, 'contact', SECTION_ID.contact],
  ] as const)('the %s %s nav label is the registry name in capitals', (locale, key, id) => {
    expect(NAV_VOCABULARY[locale][key]).toBe(localizedSectionLabel(locale, id).toUpperCase());
  });

  it('writes the back to top label in sentence case in both languages', () => {
    expect(NAVIGATION[SITE_LOCALE.en].copy.backToTopLabel).toBe('Back to top');
    expect(NAVIGATION[SITE_LOCALE.pt].copy.backToTopLabel).toBe('Voltar ao topo');
  });
});
