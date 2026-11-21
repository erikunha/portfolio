import { act, render } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubscribeCta } from './SubscribeCta.client';

const STORAGE_KEY = 'links.subscribed';
const SUBSCRIBE_LABEL = 'inscrever-se no canal';
const SUBSCRIBED_LABEL = 'ver os últimos vídeos';

const props = {
  href: 'https://www.youtube.com/channel/x?sub_confirmation=1',
  subscribedHref: 'https://www.youtube.com/channel/x/videos',
  subscribeLabel: SUBSCRIBE_LABEL,
  subscribedLabel: SUBSCRIBED_LABEL,
  outboundId: 'inscrever',
  newTabHint: 'abre em uma nova guia',
};

function visibleLabel(container: HTMLElement): string {
  return container.querySelector('.links-cta-label > span')?.textContent ?? '';
}

describe('SubscribeCta stored state', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the idle label on the server even when a subscription is stored', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    const html = renderToString(<SubscribeCta {...props} />);
    expect(html).toContain(`<span>${SUBSCRIBE_LABEL}</span>`);
    expect(html).not.toContain(`<span>${SUBSCRIBED_LABEL}</span>`);
  });

  it('hydrates server markup without a mismatch and then shows the stored subscription', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.innerHTML = renderToString(<SubscribeCta {...props} />);
    localStorage.setItem(STORAGE_KEY, '1');

    await act(async () => {
      hydrateRoot(host, <SubscribeCta {...props} />);
    });

    expect(visibleLabel(host)).toBe(SUBSCRIBED_LABEL);
    expect(errors).not.toHaveBeenCalled();
    host.remove();
  });

  it('follows a subscription stored by another tab', async () => {
    const { container } = render(<SubscribeCta {...props} />);
    expect(visibleLabel(container)).toBe(SUBSCRIBE_LABEL);

    await act(async () => {
      localStorage.setItem(STORAGE_KEY, '1');
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: '1' }));
    });

    expect(visibleLabel(container)).toBe(SUBSCRIBED_LABEL);
  });

  it('falls back to the idle label when storage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { container } = render(<SubscribeCta {...props} />);
    expect(visibleLabel(container)).toBe(SUBSCRIBE_LABEL);
  });

  it('still switches to the latest-videos action when the storage write is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { container } = render(<SubscribeCta {...props} />);
    await act(async () => {
      container.querySelector('a')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(visibleLabel(container)).toBe(SUBSCRIBED_LABEL);
  });
});
