import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function makeInstrumentedCtx() {
  const fontSets: string[] = [];
  let fillTextCalls = 0;
  let _font = '';
  const ctx = {
    get font() {
      return _font;
    },
    set font(v: string) {
      _font = v;
      fontSets.push(v);
    },
    fillStyle: '',
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(() => {
      fillTextCalls++;
    }),
  };
  return {
    ctx,
    fontSetCount: () => fontSets.length,
    fillTextCount: () => fillTextCalls,
  };
}

describe('MatrixRain canvas perf', () => {
  let mounted: MountedClient;
  let rafCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    vi.resetModules();
    rafCallbacks = [];

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      cb();
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function pumpFrames(n: number): void {
    for (let i = 0; i < n; i++) {
      const cb = rafCallbacks.shift();
      if (!cb) break;
      cb((i + 1) * 100);
    }
  }

  it('does not re-set ctx.font inside the per-frame column draw loop', async () => {
    const { MatrixRain } = await import('./MatrixRain.client');

    const instrument = makeInstrumentedCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      instrument.ctx as unknown as CanvasRenderingContext2D,
    );

    mounted = await mountClient(createElement(MatrixRain, { fontSize: 16, speed: 0.7 }));

    const fontSetsAfterInit = instrument.fontSetCount();
    expect(fontSetsAfterInit).toBeGreaterThan(0);

    await act(async () => {
      pumpFrames(5);
    });

    expect(instrument.fillTextCount()).toBeGreaterThan(0);
    expect(instrument.fontSetCount()).toBe(fontSetsAfterInit);
  });

  it('debounces the window resize handler', async () => {
    vi.useFakeTimers();
    const { MatrixRain } = await import('./MatrixRain.client');

    const rectSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeInstrumentedCtx().ctx as unknown as CanvasRenderingContext2D,
    );

    mounted = await mountClient(createElement(MatrixRain, { fontSize: 16, speed: 0.7 }));

    const callsAfterMount = rectSpy.mock.calls.length;

    await act(async () => {
      for (let i = 0; i < 10; i++) {
        window.dispatchEvent(new Event('resize'));
      }
    });
    expect(rectSpy.mock.calls.length).toBe(callsAfterMount);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(rectSpy.mock.calls.length).toBe(callsAfterMount + 1);
  });
});
