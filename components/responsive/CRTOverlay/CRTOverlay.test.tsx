import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';

describe('CRTOverlay owns the frame governor', () => {
  let mounted: MountedClient | undefined;
  let scheduled: number;
  let cancelled: number;

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    scheduled = 0;
    cancelled = 0;
    vi.stubGlobal('requestAnimationFrame', () => {
      scheduled++;
      return scheduled;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      cancelled++;
    });
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('measures frames while mounted and publishes the level on the document element', async () => {
    const { CRTOverlay } = await import('./CRTOverlay.client');
    mounted = await mountClient(createElement(CRTOverlay));

    await vi.waitFor(() => expect(scheduled, 'the overlay must start sampling frames').toBe(1));
    expect(document.documentElement.dataset.crtLevel).toBe('0');
  });

  it('stops measuring and clears the level on unmount', async () => {
    const { CRTOverlay } = await import('./CRTOverlay.client');
    mounted = await mountClient(createElement(CRTOverlay));
    await vi.waitFor(() => expect(scheduled).toBe(1));
    mounted.unmount();
    mounted = undefined;

    expect(cancelled).toBe(1);
    expect(document.documentElement.hasAttribute('data-crt-level')).toBe(false);
  });

  it('measures nothing while the motion preference is off', async () => {
    localStorage.setItem('erik.motion', 'off');
    const { CRTOverlay } = await import('./CRTOverlay.client');
    mounted = await mountClient(createElement(CRTOverlay));
    await vi.waitFor(() => expect(document.documentElement.dataset.crtLevel).toBe('0'));

    expect(scheduled).toBe(0);
  });

  it('does not start the governor when it unmounts before the module has loaded', async () => {
    let openGate: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    vi.doMock('@/lib/frame-governor', async () => {
      await gate;
      return vi.importActual('@/lib/frame-governor');
    });
    const { CRTOverlay } = await import('./CRTOverlay.client');
    mounted = await mountClient(createElement(CRTOverlay));
    mounted.unmount();
    mounted = undefined;

    openGate();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(scheduled, 'a late module load must not start a governor nobody holds').toBe(0);
    expect(document.documentElement.hasAttribute('data-crt-level')).toBe(false);
    vi.doUnmock('@/lib/frame-governor');
  });

  it('reports a governor chunk that fails to load instead of leaving an unhandled rejection', async () => {
    const report = vi.fn();
    vi.doMock('@/lib/report-client-error.client', () => ({ reportClientError: report }));
    vi.doMock('@/lib/frame-governor', () => Promise.reject(new Error('chunk load failed')));
    const { CRTOverlay } = await import('./CRTOverlay.client');
    mounted = await mountClient(createElement(CRTOverlay));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(report).toHaveBeenCalledWith(expect.any(String), expect.any(Error));
    vi.doUnmock('@/lib/frame-governor');
    vi.doUnmock('@/lib/report-client-error.client');
  });
});
