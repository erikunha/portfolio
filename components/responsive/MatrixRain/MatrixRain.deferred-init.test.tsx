import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRainTheme, declareRainTheme } from '@/__tests__/helpers/rain-theme';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';

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

describe('MatrixRain keeps its layout reads out of the hydration commit', () => {
  let mounted: MountedClient;
  let idleCallbacks: Array<() => void>;
  let rectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    declareRainTheme();
    vi.resetModules();
    idleCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      idleCallbacks.push(cb);
      return idleCallbacks.length;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    rectSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(CANVAS_RECT);
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('measures the canvas and reads the palette only once the browser is idle', async () => {
    const computedStyle = vi.spyOn(window, 'getComputedStyle');
    const { MatrixRain } = await import('./MatrixRain.client');

    mounted = await mountClient(createElement(MatrixRain, { fontSize: 16, speed: 0.7 }));

    expect(
      rectSpy,
      'a layout read in the mount effect forces a synchronous layout of the whole hydrated page; the canvas is measured in the idle window instead',
    ).not.toHaveBeenCalled();
    expect(
      computedStyle,
      'the palette read forces a style recalculation at mount',
    ).not.toHaveBeenCalled();
    expect(idleCallbacks).toHaveLength(1);

    await act(async () => {
      for (const callback of idleCallbacks) callback();
    });

    expect(rectSpy).toHaveBeenCalled();
    expect(computedStyle).toHaveBeenCalled();
    const canvas = mounted.container.querySelector('canvas');
    expect(canvas?.width, 'the backing store is sized once the idle window opens').toBe(400);
    expect(canvas?.height).toBe(300);
  });
});
