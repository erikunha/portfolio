import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisibleInterval } from './use-visible-interval.client';

const DELAY = 1000;

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  Object.defineProperty(document, 'hidden', { configurable: true, value: state === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useVisibleInterval', () => {
  it('ticks on mount and then on every delay while visible', () => {
    const callback = vi.fn();
    renderHook(() => useVisibleInterval(callback, DELAY));
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3 * DELAY);
    });

    expect(callback).toHaveBeenCalledTimes(4);
  });

  it('stops ticking while the tab is hidden', () => {
    const callback = vi.fn();
    renderHook(() => useVisibleInterval(callback, DELAY));
    act(() => setVisibility('hidden'));
    callback.mockClear();

    act(() => {
      vi.advanceTimersByTime(5 * DELAY);
    });

    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ticks at once and restarts the interval when the tab becomes visible', () => {
    const callback = vi.fn();
    renderHook(() => useVisibleInterval(callback, DELAY));
    act(() => setVisibility('hidden'));
    callback.mockClear();

    act(() => setVisibility('visible'));
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(DELAY - 1);
    });
    expect(callback).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('calls the latest callback without restarting the interval', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useVisibleInterval(cb, DELAY), {
      initialProps: { cb: first },
    });
    first.mockClear();
    act(() => {
      vi.advanceTimersByTime(DELAY / 2);
    });

    rerender({ cb: second });
    act(() => {
      vi.advanceTimersByTime(DELAY / 2);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('clears its timer and listener on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useVisibleInterval(callback, DELAY));

    unmount();
    callback.mockClear();
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    act(() => {
      vi.advanceTimersByTime(3 * DELAY);
    });

    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
