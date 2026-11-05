import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';
import { SectionNavigationProvider } from '../SectionNavigation';
import { MobileTitleBar } from './MobileTitleBar.client';

let mockPathname: string | null = null;

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('MobileTitleBar', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    mockPathname = null;
  });

  async function render(): Promise<HTMLElement> {
    mounted = await mountClient(
      createElement(
        SectionNavigationProvider,
        { chrome: siteNavChrome(SITE_LOCALE.en), locale: SITE_LOCALE.en },
        createElement(MobileTitleBar, {
          brand: createElement('a', { href: '/', 'data-test-brand': '1' }, 'brand'),
        }),
      ),
    );
    return mounted.container;
  }

  it('puts the menu trigger first and the brand last, matching focus order', async () => {
    const container = await render();
    const focusable = [...container.querySelectorAll<HTMLElement>('a[href], button')];

    expect(focusable[0]?.classList.contains('menu-trigger')).toBe(true);
    expect(focusable[1]?.getAttribute('data-test-brand')).toBe('1');
  });

  it('puts the language switch between the menu trigger and the brand', async () => {
    mockPathname = '/';
    const container = await render();
    const focusable = [...container.querySelectorAll<HTMLElement>('a[href], button')];

    expect(focusable[0]?.classList.contains('menu-trigger')).toBe(true);
    expect(focusable[1]?.closest('[data-lang-switch]')).not.toBeNull();
    expect(focusable[2]?.closest('[data-lang-switch]')).not.toBeNull();
    expect(focusable[3]?.getAttribute('data-test-brand')).toBe('1');
    expect(focusable[1]?.getAttribute('href')).toBe('/');
    expect(focusable[2]?.getAttribute('href')).toBe('/pt');
    expect(focusable[1]?.getAttribute('aria-current')).toBe('page');
  });

  it('draws no window dots', async () => {
    const container = await render();

    expect(container.querySelector('.window-chrome, [data-dot]')).toBeNull();
  });
});
