// __tests__/matrix-rain-advanced.test.tsx
// Behavioral tests for MatrixRain watchRef/IntersectionObserver path,
// visibility change pause/resume, and sysfail:start/sysfail:end event handlers.

import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

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

function makeCtx() {
  return {
    font: '',
    fillStyle: '',
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
  };
}

describe('MatrixRain — watchRef / IntersectionObserver path', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((_cb: FrameRequestCallback) => {
        // Store callback but don't auto-fire; test controls frames
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('observes the watchRef target and starts when intersecting', async () => {
    const { MatrixRain } = await import('@/components/responsive/MatrixRain/MatrixRain.client');

    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeCtx() as unknown as CanvasRenderingContext2D,
    );

    let observerCallback: IntersectionObserverCallback | null = null;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();

    // Use a class-based constructor mock (arrow functions can't be used with `new`)
    class IOMock {
      static instance: IOMock;
      observe = observeMock;
      disconnect = disconnectMock;
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb;
        IOMock.instance = this;
      }
    }
    vi.stubGlobal('IntersectionObserver', IOMock);

    // Use a plain ref-like object (React.RefObject shape)
    const watchTarget = document.createElement('div');
    document.body.appendChild(watchTarget);
    const watchRef = { current: watchTarget };

    mounted = await mountClient(createElement(MatrixRain, { watchRef }));

    // IntersectionObserver should have been created and started observing
    expect(observeMock).toHaveBeenCalledWith(watchTarget);

    // Simulate intersection: element enters viewport
    await act(async () => {
      observerCallback?.(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
    });

    // requestAnimationFrame should be called to start the loop
    expect(requestAnimationFrame).toHaveBeenCalled();

    document.body.removeChild(watchTarget);
  });

  it('disconnects IntersectionObserver on unmount', async () => {
    const { MatrixRain } = await import('@/components/responsive/MatrixRain/MatrixRain.client');

    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeCtx() as unknown as CanvasRenderingContext2D,
    );

    const disconnectMock = vi.fn();
    class IOMock {
      observe = vi.fn();
      disconnect = disconnectMock;
      constructed = true;
      constructor(_cb: IntersectionObserverCallback) {
        this.constructed = true;
      }
    }
    vi.stubGlobal('IntersectionObserver', IOMock);

    const watchTarget = document.createElement('div');
    document.body.appendChild(watchTarget);
    const watchRef = { current: watchTarget };

    mounted = await mountClient(createElement(MatrixRain, { watchRef }));
    mounted.unmount();

    expect(disconnectMock).toHaveBeenCalled();

    document.body.removeChild(watchTarget);
  });

  it('falls back to immediate resume when watchRef.current is null (no target)', async () => {
    const { MatrixRain } = await import('@/components/responsive/MatrixRain/MatrixRain.client');

    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeCtx() as unknown as CanvasRenderingContext2D,
    );

    // watchRef.current = null: the condition `if (target && ...)` is false
    // so it falls through to resume() immediately
    const watchRef = { current: null };

    mounted = await mountClient(createElement(MatrixRain, { watchRef }));

    // Falls back to resume() immediately → requestAnimationFrame called
    expect(requestAnimationFrame).toHaveBeenCalled();
  });
});

describe('MatrixRain — visibility change pause/resume', () => {
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

  it('pauses the loop when document becomes hidden', async () => {
    const { MatrixRain } = await import('@/components/responsive/MatrixRain/MatrixRain.client');

    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeCtx() as unknown as CanvasRenderingContext2D,
    );

    mounted = await mountClient(createElement(MatrixRain));

    // Simulate tab hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // cancelAnimationFrame should have been called (pause)
    expect(cancelAnimationFrame).toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('resumes the loop when document becomes visible', async () => {
    const { MatrixRain } = await import('@/components/responsive/MatrixRain/MatrixRain.client');

    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeCtx() as unknown as CanvasRenderingContext2D,
    );

    mounted = await mountClient(createElement(MatrixRain));

    // Pause first
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    const rafCountAfterPause = rafCallbacks.length;

    // Then resume
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // requestAnimationFrame should be called again after resume
    expect(rafCallbacks.length).toBeGreaterThan(rafCountAfterPause);
  });
});

describe('MatrixRain — sysfail:start / sysfail:end events', () => {
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
  });

  it('pauses canvas loop on sysfail:start event', async () => {
    const { MatrixRain } = await import('@/components/responsive/MatrixRain/MatrixRain.client');

    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeCtx() as unknown as CanvasRenderingContext2D,
    );

    mounted = await mountClient(createElement(MatrixRain));

    window.dispatchEvent(new CustomEvent('sysfail:start'));

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('resumes canvas loop on sysfail:end event', async () => {
    const { MatrixRain } = await import('@/components/responsive/MatrixRain/MatrixRain.client');

    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeCtx() as unknown as CanvasRenderingContext2D,
    );

    mounted = await mountClient(createElement(MatrixRain));

    // Pause first
    window.dispatchEvent(new CustomEvent('sysfail:start'));
    const rafCountAfterPause = rafCallbacks.length;

    // Resume
    window.dispatchEvent(new CustomEvent('sysfail:end'));
    expect(rafCallbacks.length).toBeGreaterThan(rafCountAfterPause);
  });

  it('removes sysfail listeners on unmount', async () => {
    const { MatrixRain } = await import('@/components/responsive/MatrixRain/MatrixRain.client');

    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeCtx() as unknown as CanvasRenderingContext2D,
    );

    mounted = await mountClient(createElement(MatrixRain));
    mounted.unmount();

    const rafCountAfterUnmount = rafCallbacks.length;

    // After unmount, sysfail:end should NOT restart the loop
    window.dispatchEvent(new CustomEvent('sysfail:end'));
    expect(rafCallbacks.length).toBe(rafCountAfterUnmount);
  });
});
