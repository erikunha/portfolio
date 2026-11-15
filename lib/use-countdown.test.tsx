import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MS_PER_MINUTE } from '@/lib/time';
import { useCountdown } from './use-countdown.client';

const START = 1_700_000_000_000;
const SPAN_MS = 150_000;

type Props = { until: number | null };

function countdown(onElapsed: () => void = vi.fn()) {
  return ({ until }: Props) => useCountdown({ until, stepMs: MS_PER_MINUTE, onElapsed });
}

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing without a deadline', () => {
    const onElapsed = vi.fn();
    renderHook(countdown(onElapsed), { initialProps: { until: null } });
    act(() => {
      vi.advanceTimersByTime(10 * MS_PER_MINUTE);
    });
    expect(onElapsed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports the current time when a deadline starts', () => {
    const { result, rerender } = renderHook(countdown(), {
      initialProps: { until: null as number | null },
    });
    act(() => {
      vi.setSystemTime(START + 5_000);
    });
    rerender({ until: START + SPAN_MS });
    expect(result.current).toBe(START + 5_000);
  });

  it('ticks only where the remaining time crosses a whole step', () => {
    const { result } = renderHook(countdown(), { initialProps: { until: START + SPAN_MS } });
    act(() => {
      vi.advanceTimersByTime(29_999);
    });
    expect(result.current).toBe(START);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(START + 30_000);
    act(() => {
      vi.advanceTimersByTime(MS_PER_MINUTE);
    });
    expect(result.current).toBe(START + 90_000);
  });

  it('calls onElapsed once the deadline passes', () => {
    const onElapsed = vi.fn();
    renderHook(countdown(onElapsed), { initialProps: { until: START + 90_000 } });
    act(() => {
      vi.advanceTimersByTime(89_999);
    });
    expect(onElapsed).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(MS_PER_MINUTE);
    });
    expect(onElapsed).toHaveBeenCalledOnce();
  });

  it('calls onElapsed straight away for a deadline already past', () => {
    const onElapsed = vi.fn();
    renderHook(countdown(onElapsed), { initialProps: { until: START - 1 } });
    expect(onElapsed).toHaveBeenCalledOnce();
  });

  it('calls the latest onElapsed, not the one from the first render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ onElapsed }: { onElapsed: () => void }) =>
        useCountdown({ until: START + 45_000, stepMs: MS_PER_MINUTE, onElapsed }),
      { initialProps: { onElapsed: first } },
    );
    rerender({ onElapsed: second });
    act(() => {
      vi.advanceTimersByTime(MS_PER_MINUTE);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('clears its timer when the deadline is cancelled or the hook unmounts', () => {
    const { rerender, unmount } = renderHook(countdown(), {
      initialProps: { until: (START + SPAN_MS) as number | null },
    });
    expect(vi.getTimerCount()).toBe(1);
    rerender({ until: null });
    expect(vi.getTimerCount()).toBe(0);
    rerender({ until: START + SPAN_MS });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
