import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
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
        null,
        createElement(MobileTitleBar, {
          brand: createElement('a', { href: '/', 'data-test-brand': '1' }, 'brand'),
        }),
      ),
    );
    return mounted.container;
  }

  it('puts the brand first and the menu trigger last, matching focus order', async () => {
    const container = await render();
    const focusable = [...container.querySelectorAll<HTMLElement>('a[href], button')];

    expect(focusable[0]?.getAttribute('data-test-brand')).toBe('1');
    expect(focusable.at(-1)?.classList.contains('menu-trigger')).toBe(true);
  });

  it('draws no window dots', async () => {
    const container = await render();

    expect(container.querySelector('.window-chrome, [data-dot]')).toBeNull();
  });
});
