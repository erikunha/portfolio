import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

describe('StatusBar — visibilitychange handler', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  async function render() {
    const { StatusBar } = await import('@/components/responsive/StatusBar/StatusBar.client');
    mounted = await mountClient(createElement(StatusBar));
    return mounted.container;
  }

  it('clears interval when document becomes hidden', async () => {
    await render();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(clearSpy).toHaveBeenCalled();
  });

  it('restarts the clock when document becomes visible again', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    await render();

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const callsAfterHide = setIntervalSpy.mock.calls.length;

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(setIntervalSpy.mock.calls.length).toBeGreaterThan(callsAfterHide);
  });

  it('does not clear interval if it was already null (hidden while interval was null)', async () => {
    await render();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const callsAfterFirstHide = clearSpy.mock.calls.length;

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(clearSpy.mock.calls.length).toBe(callsAfterFirstHide);
  });

  it('removes visibilitychange listener on unmount', async () => {
    await render();
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    mounted.unmount();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
