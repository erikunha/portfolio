import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SubscribeCta } from './SubscribeCta.client';

const SUBSCRIBE_HREF = 'https://www.youtube.com/channel/x?sub_confirmation=1';
const VIDEOS_HREF = 'https://www.youtube.com/channel/x/videos';

function renderCta() {
  return render(
    <SubscribeCta
      href={SUBSCRIBE_HREF}
      subscribedHref={VIDEOS_HREF}
      subscribeLabel="inscrever-se no canal"
      subscribedLabel="ver os últimos vídeos"
      outboundId="inscrever"
    />,
  );
}

function anchor(container: HTMLElement): HTMLAnchorElement {
  const link = container.querySelector('a');
  expect(link).not.toBeNull();
  return link as HTMLAnchorElement;
}

describe('SubscribeCta', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('offers the subscribe action to a first-time visitor', () => {
    const { container } = renderCta();
    const link = anchor(container);
    expect(link.textContent).toContain('inscrever-se no canal');
    expect(link.getAttribute('href')).toBe(SUBSCRIBE_HREF);
  });

  it('switches to the latest-videos action after the visitor subscribes', async () => {
    const { container } = renderCta();
    await act(async () => {
      anchor(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const link = anchor(container);
    expect(link.textContent).toContain('ver os últimos vídeos');
    expect(link.getAttribute('href')).toBe(VIDEOS_HREF);
  });

  it('records the subscription so a return visit skips the ask', async () => {
    const { container } = renderCta();
    await act(async () => {
      anchor(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(localStorage.getItem('links.subscribed')).toBe('1');
  });

  it('remembers the subscription across a reload', () => {
    localStorage.setItem('links.subscribed', '1');
    const { container } = renderCta();
    expect(anchor(container).textContent).toContain('ver os últimos vídeos');
  });

  it('opens the channel in a new tab without leaking the opener', () => {
    const { container } = renderCta();
    const link = anchor(container);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('is marked outbound so the page shows the same loading feedback as every other link', () => {
    const { container } = renderCta();
    expect(anchor(container).getAttribute('data-outbound')).toBe('inscrever');
  });
});
