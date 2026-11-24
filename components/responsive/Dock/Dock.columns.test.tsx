import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';
import { siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';
import { SectionNavigationProvider } from '../SectionNavigation';
import { Dock } from './Dock.client';

describe('Dock columns', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('declares one column per control, so a half-parsed dock does not stretch its first items', () => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    installMatchMedia(false);
    const chrome = siteNavChrome(SITE_LOCALE.en);
    const { container } = render(
      <SectionNavigationProvider chrome={chrome} locale={SITE_LOCALE.en}>
        <Dock />
      </SectionNavigationProvider>,
    );
    const nav = container.querySelector<HTMLElement>('nav.dock');
    expect(nav?.style.getPropertyValue('--dock-columns')).toBe(
      String(chrome.navigation.dock.length),
    );
  });
});
