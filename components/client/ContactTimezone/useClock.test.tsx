import { act, render, renderHook } from '@testing-library/react';
import { type RefObject, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow, usePanelActive } from './useClock';

const SECOND = 1000;
const MINUTE = 60_000;
const START = new Date('2026-01-15T12:00:00.400Z');

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let emitIntersection: ObserverCallback = () => undefined;
let observerDisconnected = false;

class FakeIntersectionObserver {
  constructor(callback: ObserverCallback) {
    emitIntersection = callback;
    observerDisconnected = false;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect() {
    observerDisconnected = true;
  }
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useNow', () => {
  it('does not tick while inactive', () => {
    const { result } = renderHook(() => useNow(false, SECOND));
    const first = result.current.getTime();

    act(() => {
      vi.advanceTimersByTime(5 * SECOND);
    });

    expect(result.current.getTime()).toBe(first);
  });

  it('ticks on each second boundary while active', () => {
    const { result } = renderHook(() => useNow(true, SECOND));

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.getTime() % SECOND).toBe(0);
    const afterFirst = result.current.getTime();

    act(() => {
      vi.advanceTimersByTime(SECOND);
    });
    expect(result.current.getTime()).toBe(afterFirst + SECOND);
  });

  it('ticks a minute hook once per minute, not once per second', () => {
    const { result } = renderHook(() => useNow(true, MINUTE));
    act(() => {
      vi.advanceTimersByTime(30 * SECOND);
    });
    expect(result.current.getTime() % MINUTE).not.toBe(0);

    act(() => {
      vi.advanceTimersByTime(30 * SECOND);
    });
    expect(result.current.getTime() % MINUTE).toBe(0);
  });

  it('catches up to the real time when it becomes active again', () => {
    const { result, rerender } = renderHook(({ active }) => useNow(active, SECOND), {
      initialProps: { active: true },
    });
    rerender({ active: false });
    const stale = result.current.getTime();

    act(() => {
      vi.advanceTimersByTime(10 * MINUTE);
    });
    rerender({ active: true });

    expect(result.current.getTime()).toBeGreaterThanOrEqual(stale + 10 * MINUTE);
  });

  it('clears its timer on unmount', () => {
    const { unmount } = renderHook(() => useNow(true, SECOND));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

function Probe({ onActive }: { onActive: (active: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  onActive(usePanelActive(ref as RefObject<Element | null>));
  return <div ref={ref} />;
}

describe('usePanelActive', () => {
  it('is active only while the panel is in view and the tab is visible', () => {
    const seen: boolean[] = [];
    render(<Probe onActive={(active) => seen.push(active)} />);
    const latest = () => seen[seen.length - 1];
    expect(latest()).toBe(false);

    act(() => emitIntersection([{ isIntersecting: true }]));
    expect(latest()).toBe(true);

    act(() => setVisibility('hidden'));
    expect(latest()).toBe(false);

    act(() => setVisibility('visible'));
    expect(latest()).toBe(true);

    act(() => emitIntersection([{ isIntersecting: false }]));
    expect(latest()).toBe(false);
  });

  it('counts as in view when the browser has no IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const seen: boolean[] = [];

    render(<Probe onActive={(active) => seen.push(active)} />);

    expect(seen[seen.length - 1]).toBe(true);
  });

  it('stops observing on unmount', () => {
    const { unmount } = render(<Probe onActive={() => undefined} />);

    unmount();

    expect(observerDisconnected).toBe(true);
  });
});
