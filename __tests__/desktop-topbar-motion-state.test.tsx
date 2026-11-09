import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION_STATE_SEPARATOR } from '@/content/nav';
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';
import { type MountedClient, mountClient } from './helpers/render';

const { copy } = NAVIGATION[SITE_LOCALE.en];

describe('DesktopTopbar MOTION toggle shows its state', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  async function mountTopbar(initial: boolean) {
    vi.doMock('@/lib/motion', () => ({ readMotion: () => initial, applyMotion: vi.fn() }));
    const { SectionNavigationProvider } = await import('@/components/responsive/SectionNavigation');
    const { DesktopTopbar } = await import(
      '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
    );
    mounted = await mountClient(
      createElement(
        SectionNavigationProvider,
        { chrome: siteNavChrome(SITE_LOCALE.en), locale: SITE_LOCALE.en },
        createElement(DesktopTopbar, { brand: null }),
      ),
    );
    return mounted.container.querySelector('button[data-motion]') as HTMLButtonElement;
  }

  it('prints ON next to the label while motion runs and OFF after the click', async () => {
    const button = await mountTopbar(true);
    expect(button.textContent, 'the visible state label is missing').toContain(
      `${MOTION_STATE_SEPARATOR}${copy.motionOn}`,
    );
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(button.textContent).toContain(`${MOTION_STATE_SEPARATOR}${copy.motionOff}`);
    expect(button.textContent).not.toContain(`${MOTION_STATE_SEPARATOR}${copy.motionOn}`);
  });

  it('keeps aria-pressed as the programmatic state and the accessible name on the label only', async () => {
    const button = await mountTopbar(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    const hidden = [...button.querySelectorAll('[aria-hidden="true"]')].find((node) =>
      node.textContent?.includes(copy.motionOff),
    );
    expect(hidden, 'the state text must be hidden from the accessible name').toBeDefined();
  });
});
