import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRainTheme, declareRainTheme } from '@/__tests__/helpers/rain-theme';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { applyMotion } from '@/lib/motion';

const CANVAS_RECT = {
  width: 400,
  height: 300,
  top: 0,
  left: 0,
  right: 400,
  bottom: 300,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('MatrixRain honours the motion preference through every pause source', () => {
  let mounted: MountedClient;
  let scheduled: number;
  let cancelled: number;

  beforeEach(() => {
    declareRainTheme();
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
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      cb();
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      font: '',
      fillStyle: '',
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    clearRainTheme();
    mounted?.unmount();
    setHidden(false);
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('stays still when the tab becomes visible while motion is off', async () => {
    localStorage.setItem('erik.motion', 'off');
    const { MatrixRain } = await import('./MatrixRain.client');
    mounted = await mountClient(createElement(MatrixRain));

    setHidden(true);
    setHidden(false);

    expect(scheduled).toBe(0);
  });

  it('stays still when a system-failure beat ends while motion is off', async () => {
    localStorage.setItem('erik.motion', 'off');
    const { MatrixRain } = await import('./MatrixRain.client');
    mounted = await mountClient(createElement(MatrixRain));

    window.dispatchEvent(new CustomEvent('sysfail:start'));
    window.dispatchEvent(new CustomEvent('sysfail:end'));

    expect(scheduled).toBe(0);
  });

  it('starts when motion is switched on after loading with it off', async () => {
    localStorage.setItem('erik.motion', 'off');
    const { MatrixRain } = await import('./MatrixRain.client');
    mounted = await mountClient(createElement(MatrixRain));
    expect(scheduled).toBe(0);

    await act(async () => {
      applyMotion(true);
    });

    expect(scheduled).toBeGreaterThan(0);
  });

  it('does not resume while the tab is hidden when motion is switched on', async () => {
    localStorage.setItem('erik.motion', 'off');
    const { MatrixRain } = await import('./MatrixRain.client');
    mounted = await mountClient(createElement(MatrixRain));

    setHidden(true);
    await act(async () => {
      applyMotion(true);
    });

    expect(scheduled).toBe(0);
  });

  it('stays paused through a system-failure beat after motion is switched off', async () => {
    const { MatrixRain } = await import('./MatrixRain.client');
    mounted = await mountClient(createElement(MatrixRain));
    expect(scheduled).toBeGreaterThan(0);

    window.dispatchEvent(new CustomEvent('sysfail:start'));
    await act(async () => {
      applyMotion(false);
    });
    const afterOff = scheduled;
    window.dispatchEvent(new CustomEvent('sysfail:end'));

    expect(scheduled).toBe(afterOff);
    expect(cancelled).toBeGreaterThan(0);
  });
});
