import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionNavigationProvider } from '@/components/responsive/SectionNavigation';
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';
import { longestCopy } from '@/lib/longest-copy';
import { type MountedClient, mountClient } from './helpers/render';

vi.mock('next/navigation', () => ({ usePathname: () => null }));

const TOGGLE = '.topbar-action-toggle';
const STATE_SLOT = '.topbar-motion-state';

async function renderTopbar(): Promise<MountedClient> {
  const { DesktopTopbar } = await import(
    '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
  );
  return mountClient(
    createElement(
      SectionNavigationProvider,
      { chrome: siteNavChrome(SITE_LOCALE.en), locale: SITE_LOCALE.en },
      createElement(DesktopTopbar, { brand: createElement('a', { href: '/' }, 'brand') }),
    ),
  );
}

describe('DesktopTopbar: MOTION toggle keeps one width in both states', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  it('reserves the longer state word so VIEW_CV and HIRE do not shift', async () => {
    const { motionOn, motionOff } = NAVIGATION[SITE_LOCALE.en].copy;
    const reserved = longestCopy([motionOn, motionOff]);
    mounted = await renderTopbar();
    const slot = mounted.container.querySelector(`${TOGGLE} ${STATE_SLOT}`);
    expect(slot, 'the state word sits in a slot that owns the reserved width').not.toBeNull();
    expect(slot?.getAttribute('data-reserve')).toBe(reserved);
    const stateBefore = slot?.textContent;

    await act(async () => {
      mounted.container.querySelector<HTMLButtonElement>(TOGGLE)?.click();
    });
    const after = mounted.container.querySelector(`${TOGGLE} ${STATE_SLOT}`);
    expect(after?.getAttribute('data-reserve')).toBe(reserved);
    expect(after?.textContent, 'the toggle changed the visible state word').not.toBe(stateBefore);
  });
});
