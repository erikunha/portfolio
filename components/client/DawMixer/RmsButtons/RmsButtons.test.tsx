import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { flushMicrotasks, mountClient } from '@/__tests__/helpers/render';
import { RmsButtons } from './RmsButtons.client';

function renderStatic(props: Parameters<typeof RmsButtons>[0]) {
  const html = renderToStaticMarkup(createElement(RmsButtons, props));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('RmsButtons — initial render', () => {
  it('renders one button per label', () => {
    const doc = renderStatic({ buttons: ['R', 'M', 'S'], initialActive: [], channelName: 'CH 01' });
    expect(doc.querySelectorAll('button').length).toBe(3);
  });

  it('aria-label includes channelName prefix for each button', () => {
    const doc = renderStatic({ buttons: ['R', 'M', 'S'], initialActive: [], channelName: 'CH 01' });
    const buttons = Array.from(doc.querySelectorAll('button'));
    const rBtn = buttons.find((b) => b.textContent?.trim() === 'R');
    const mBtn = buttons.find((b) => b.textContent?.trim() === 'M');
    const sBtn = buttons.find((b) => b.textContent?.trim() === 'S');
    expect(rBtn?.getAttribute('aria-label')).toBe('CH 01 record arm');
    expect(mBtn?.getAttribute('aria-label')).toBe('CH 01 mute');
    expect(sBtn?.getAttribute('aria-label')).toBe('CH 01 solo');
  });

  it('active buttons have aria-pressed="true"', () => {
    const doc = renderStatic({
      buttons: ['R', 'M', 'S'],
      initialActive: ['M'],
      channelName: 'CH 01',
    });
    const buttons = doc.querySelectorAll('button');
    const mBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'M');
    expect(mBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('inactive buttons have aria-pressed="false"', () => {
    const doc = renderStatic({ buttons: ['R', 'M', 'S'], initialActive: [], channelName: 'CH 01' });
    const buttons = doc.querySelectorAll('button');
    for (const b of buttons) {
      expect(b.getAttribute('aria-pressed')).toBe('false');
    }
  });
});

describe('RmsButtons — toggle interaction', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it('clicking an inactive button sets aria-pressed to true', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(RmsButtons, {
        buttons: ['R', 'M', 'S'],
        initialActive: [],
        channelName: 'CH 01',
      }),
    );
    unmount = u;
    const rBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'R',
    ) as HTMLButtonElement;
    await act(async () => {
      rBtn.click();
    });
    await flushMicrotasks();
    expect(rBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking an active button sets aria-pressed to false', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(RmsButtons, {
        buttons: ['R', 'M', 'S'],
        initialActive: ['S'],
        channelName: 'CH 01',
      }),
    );
    unmount = u;
    const sBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'S',
    ) as HTMLButtonElement;
    await act(async () => {
      sBtn.click();
    });
    await flushMicrotasks();
    expect(sBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggling one button does not affect others', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(RmsButtons, {
        buttons: ['R', 'M', 'S'],
        initialActive: ['M'],
        channelName: 'CH 01',
      }),
    );
    unmount = u;
    const rBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'R',
    ) as HTMLButtonElement;
    const mBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'M',
    ) as HTMLButtonElement;
    await act(async () => {
      rBtn.click();
    });
    await flushMicrotasks();
    expect(mBtn.getAttribute('aria-pressed')).toBe('true');
  });
});
