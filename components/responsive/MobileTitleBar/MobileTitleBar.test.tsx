import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';
import { SectionNavigationProvider } from '../SectionNavigation';
import { MobileTitleBar } from './MobileTitleBar.client';

describe('MobileTitleBar', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
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

  it('draws no window dots', async () => {
    const container = await render();

    expect(container.querySelector('.window-chrome, [data-dot]')).toBeNull();
  });
});
