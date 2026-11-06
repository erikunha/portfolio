import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { applyMotion } from '@/lib/motion';
import { AnimatedPlaceholder } from './AnimatedPlaceholder.client';

const ui = shellUi[SITE_LOCALE.en];
const HOLD_SETTLE_MS = 4000;

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;
let reportIntersection: ObserverCallback = () => undefined;

class ObserverStub {
  constructor(callback: ObserverCallback) {
    reportIntersection = callback;
  }
  observe = vi.fn();
  disconnect = vi.fn();
}

describe('AnimatedPlaceholder follows the motion switch and the viewport', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', ObserverStub);
  });

  afterEach(() => {
    mounted?.unmount();
    localStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function mount() {
    mounted = await mountClient(createElement(AnimatedPlaceholder, { ui }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    return mounted.container.querySelector('[data-testid="shell-placeholder"] > span');
  }

  it('shows the static placeholder and stops typing when motion is switched off', async () => {
    const text = await mount();
    expect(vi.getTimerCount(), 'the placeholder types while motion is on').toBeGreaterThan(0);

    await act(async () => {
      applyMotion(false);
    });

    expect(vi.getTimerCount(), 'motion off must leave no typing timer').toBe(0);
    expect(text?.textContent).toBe(ui.placeholder);
  });

  it('types again when motion is switched back on', async () => {
    localStorage.setItem('erik.motion', 'off');
    const text = await mount();
    expect(vi.getTimerCount()).toBe(0);
    expect(text?.textContent).toBe(ui.placeholder);

    await act(async () => {
      applyMotion(true);
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it('stops typing while the shell is scrolled out of view and resumes in view', async () => {
    const text = await mount();

    await act(async () => {
      reportIntersection([{ isIntersecting: false }]);
      await vi.advanceTimersByTimeAsync(HOLD_SETTLE_MS);
    });
    const frozen = text?.textContent;
    expect(vi.getTimerCount(), 'an off-screen placeholder keeps no timer').toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOLD_SETTLE_MS);
    });
    expect(text?.textContent).toBe(frozen);

    await act(async () => {
      reportIntersection([{ isIntersecting: true }]);
      await vi.advanceTimersByTimeAsync(HOLD_SETTLE_MS);
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });
});
