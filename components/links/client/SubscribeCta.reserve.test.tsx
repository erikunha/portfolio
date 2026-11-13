import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SubscribeCta } from './SubscribeCta.client';

const SUBSCRIBE_LABEL = 'inscrever-se no canal';
const SUBSCRIBED_LABEL = 'ver os últimos vídeos e playlists';

function renderCta() {
  return render(
    <SubscribeCta
      href="https://www.youtube.com/channel/x?sub_confirmation=1"
      subscribedHref="https://www.youtube.com/channel/x/videos"
      subscribeLabel={SUBSCRIBE_LABEL}
      subscribedLabel={SUBSCRIBED_LABEL}
      outboundId="inscrever"
      newTabHint="abre em uma nova guia"
    />,
  );
}

describe('SubscribeCta: width stays fixed when the label swaps after hydration', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('reserves the longer of the two labels before and after the swap', async () => {
    const { container } = renderCta();
    const slot = container.querySelector('[data-reserve]');
    expect(slot, 'the label sits in a slot that owns the reserved width').not.toBeNull();
    expect(slot?.getAttribute('data-reserve')).toBe(SUBSCRIBED_LABEL);

    await act(async () => {
      container.querySelector('a')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('[data-reserve]')?.getAttribute('data-reserve')).toBe(
      SUBSCRIBED_LABEL,
    );
    expect(container.querySelector('[data-reserve]')?.textContent).toBe(SUBSCRIBED_LABEL);
  });
});
