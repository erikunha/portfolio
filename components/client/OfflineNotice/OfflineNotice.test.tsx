import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { offlineNotice } from '@/content/offline';
import { OfflineNoticeSchema } from '@/content/shell-states.schema';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { OfflineNotice } from './OfflineNotice.client';

describe('OfflineNotice', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined as unknown as MountedClient;
    vi.restoreAllMocks();
  });

  async function mountWith(online: boolean, locale: SiteLocale = SITE_LOCALE.en) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
    mounted = await mountClient(createElement(OfflineNotice, { copy: offlineNotice[locale] }));
    return mounted.container;
  }

  async function go(online: boolean) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
    await act(async () => {
      window.dispatchEvent(new Event(online ? 'online' : 'offline'));
    });
  }

  it('keeps an empty status region while online so a later change is announced', async () => {
    const container = await mountWith(true);
    const region = container.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region?.textContent).toBe('');
  });

  it('shows the no signal notice when the browser goes offline and clears it on reconnect', async () => {
    const container = await mountWith(true);
    await go(false);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      '○ NO SIGNALyou are offline · forms will wait, pages already open still work',
    );
    await go(true);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
  });

  it('shows the notice at mount when the page opens offline', async () => {
    const container = await mountWith(false);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('○ NO SIGNAL');
  });

  it('speaks Portuguese', async () => {
    const container = await mountWith(false, SITE_LOCALE.pt);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('○ SEM SINAL');
  });

  it('renders the copy it is given instead of looking one up', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    mounted = await mountClient(
      createElement(OfflineNotice, { copy: { badge: 'BADGE-PROBE', message: 'message-probe' } }),
    );
    expect(mounted.container.querySelector('[role="status"]')?.textContent).toBe(
      'BADGE-PROBEmessage-probe',
    );
  });

  it('stops listening when it unmounts', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const local = await mountClient(
      createElement(OfflineNotice, { copy: offlineNotice[SITE_LOCALE.en] }),
    );
    local.unmount();
    const removed = remove.mock.calls.map(([type]) => type);
    expect(removed).toEqual(expect.arrayContaining(['online', 'offline']));
  });

  it.each(Object.values(SITE_LOCALE))('keeps %s copy valid and free of dashes', (locale) => {
    const copy = OfflineNoticeSchema.parse(offlineNotice[locale]);
    expect(Object.values(copy).join(' ')).not.toMatch(/[–—]/);
  });
});
