// __tests__/matrix-rain.test.ts
// Behavioral test (CG3): renders the real MatrixRain and exercises its canvas
// draw loop against an instrumented 2D context — instead of slicing the
// component source and string-matching the for-loop body.
//
// Guarantees under test:
//   1. ctx.font is set during init/resize but NOT inside the per-frame column
//      draw loop. Re-assigning ctx.font every frame forces the browser to
//      re-parse the font shorthand — a measurable per-frame cost. We assert
//      the font setter count does not climb once frames start running.
//   2. The window resize handler is debounced — a burst of resize events
//      triggers at most one resize recomputation after the debounce window.

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

// An instrumented CanvasRenderingContext2D stand-in. Records every assignment
// to `font` and counts fillText calls so we can tell init from frame work.
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
  let container: HTMLElement;
  let root: import('react-dom/client').Root;
  let rafCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    vi.resetModules();
    container = document.createElement('div');
    document.body.appendChild(container);
    rafCallbacks = [];

    // Deterministic rAF: queue callbacks so the test drives frames explicitly.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    // Run the deferred loop-start synchronously so the test stays linear.
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      cb();
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // Pump n queued rAF frames. frame() re-queues itself, so each shift+call
  // both draws and enqueues the next frame.
  function pumpFrames(n: number): void {
    for (let i = 0; i < n; i++) {
      const cb = rafCallbacks.shift();
      if (!cb) break;
      // Advance the timestamp past the 1000/22ms frame budget so the draw
      // branch executes (not just the rAF re-queue).
      cb((i + 1) * 100);
    }
  }

  it('does not re-set ctx.font inside the per-frame column draw loop', async () => {
    const { createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { MatrixRain } = await import('@/components/responsive/MatrixRain.client');

    const instrument = makeInstrumentedCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      instrument.ctx as unknown as CanvasRenderingContext2D,
    );

    root = createRoot(container);
    await act(async () => {
      root.render(createElement(MatrixRain, { fontSize: 16, speed: 0.7 }));
    });

    // Effect ran resize() once → font is set during init.
    const fontSetsAfterInit = instrument.fontSetCount();
    expect(fontSetsAfterInit).toBeGreaterThan(0);

    // The deferred loop-start ran synchronously (requestIdleCallback stub) and
    // queued the first frame. Pump several frames.
    await act(async () => {
      pumpFrames(5);
    });

    // The draw loop ran (fillText was called for columns) ...
    expect(instrument.fillTextCount()).toBeGreaterThan(0);
    // ... but ctx.font was NOT re-assigned during any of those frames.
    expect(instrument.fontSetCount()).toBe(fontSetsAfterInit);
  });

  it('debounces the window resize handler', async () => {
    vi.useFakeTimers();
    const { createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { MatrixRain } = await import('@/components/responsive/MatrixRain.client');

    const rectSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeInstrumentedCtx().ctx as unknown as CanvasRenderingContext2D,
    );

    root = createRoot(container);
    await act(async () => {
      root.render(createElement(MatrixRain, { fontSize: 16, speed: 0.7 }));
    });

    // resize() ran once on mount — each call queries getBoundingClientRect.
    const callsAfterMount = rectSpy.mock.calls.length;

    // Fire a burst of resize events within the 100ms debounce window.
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        window.dispatchEvent(new Event('resize'));
      }
    });
    // Before the debounce window elapses, no extra resize work has run.
    expect(rectSpy.mock.calls.length).toBe(callsAfterMount);

    // After the debounce window: exactly ONE resize recomputation, not ten.
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(rectSpy.mock.calls.length).toBe(callsAfterMount + 1);
  });
});
