// __tests__/status-bar-visibility.test.tsx
// Behavioral tests for StatusBar visibilitychange handler.
// Lines 29-35 (onVisibility) are uncovered — exercises pause on hidden and
// restart on visible.

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
    // Restore document.hidden to default
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

    // First, hide the document to pause the clock
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const callsAfterHide = setIntervalSpy.mock.calls.length;

    // Now show — startClock() should schedule a new interval
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // setInterval must have been called again to restart the clock.
    expect(setIntervalSpy.mock.calls.length).toBeGreaterThan(callsAfterHide);
  });

  it('does not clear interval if it was already null (hidden while interval was null)', async () => {
    await render();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    // Fire hidden twice — second time the id should already be null
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const callsAfterFirstHide = clearSpy.mock.calls.length;

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Should not have called clearInterval again (id is null)
    expect(clearSpy.mock.calls.length).toBe(callsAfterFirstHide);
  });

  it('removes visibilitychange listener on unmount', async () => {
    await render();
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    mounted.unmount();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
