import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPY_FEEDBACK_RESET_MS, COPY_STATUS, useCopyFeedback } from './use-copy-feedback.client';

describe('useCopyFeedback', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts idle', () => {
    const { result } = renderHook(() => useCopyFeedback());
    expect(result.current.status).toBe(COPY_STATUS.Idle);
    expect(result.current.attempt).toBe(0);
  });

  it('copies, reports copied and returns to idle after the shared reset delay', async () => {
    const { result } = renderHook(() => useCopyFeedback());
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.copy('value');
    });
    expect(outcome).toBe(COPY_STATUS.Copied);
    expect(writeText).toHaveBeenCalledWith('value');
    expect(result.current.status).toBe(COPY_STATUS.Copied);
    await act(async () => vi.advanceTimersByTime(COPY_FEEDBACK_RESET_MS));
    expect(result.current.status).toBe(COPY_STATUS.Idle);
  });

  it('keeps the outcome until the next attempt when the reset is disabled', async () => {
    const { result } = renderHook(() => useCopyFeedback({ resetMs: null }));
    await act(async () => {
      await result.current.copy('value');
    });
    await act(async () => vi.advanceTimersByTime(COPY_FEEDBACK_RESET_MS * 10));
    expect(result.current.status).toBe(COPY_STATUS.Copied);
  });

  it('reports a rejected write and keeps the failure until the next attempt', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const { result } = renderHook(() => useCopyFeedback());
    await act(async () => {
      await result.current.copy('value');
    });
    expect(result.current.status).toBe(COPY_STATUS.Failed);
    await act(async () => vi.advanceTimersByTime(COPY_FEEDBACK_RESET_MS * 3));
    expect(result.current.status).toBe(COPY_STATUS.Failed);
    await act(async () => {
      await result.current.copy('value');
    });
    expect(result.current.status).toBe(COPY_STATUS.Copied);
  });

  it('resets a failure too when asked', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const { result } = renderHook(() => useCopyFeedback({ resetOnFailure: true }));
    await act(async () => {
      await result.current.copy('value');
    });
    await act(async () => vi.advanceTimersByTime(COPY_FEEDBACK_RESET_MS));
    expect(result.current.status).toBe(COPY_STATUS.Idle);
  });

  it.each([undefined, {}])('reports unavailable clipboard access: %s', async (clipboard) => {
    vi.stubGlobal('navigator', { clipboard });
    const { result } = renderHook(() => useCopyFeedback());
    await act(async () => {
      await result.current.copy('value');
    });
    expect(result.current.status).toBe(COPY_STATUS.Unavailable);
  });

  it('bumps the attempt on every copy so a repeated outcome is announced again', async () => {
    const { result } = renderHook(() => useCopyFeedback());
    await act(async () => {
      await result.current.copy('a');
    });
    await act(async () => {
      await result.current.copy('a');
    });
    expect(result.current.attempt).toBe(2);
  });

  it('ignores a copy while another write is pending and shows the pending state', async () => {
    let finish: (() => void) | undefined;
    writeText.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useCopyFeedback());
    let first: Promise<unknown> | undefined;
    await act(async () => {
      first = result.current.copy('a');
    });
    expect(result.current.status).toBe(COPY_STATUS.Pending);
    await act(async () => {
      await result.current.copy('b');
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish?.();
      await first;
    });
    expect(result.current.status).toBe(COPY_STATUS.Copied);
  });

  it('does not let an earlier success timer erase a later failure', async () => {
    const { result } = renderHook(() => useCopyFeedback());
    await act(async () => {
      await result.current.copy('a');
    });
    writeText.mockRejectedValueOnce(new Error('denied'));
    await act(async () => {
      await result.current.copy('a');
    });
    await act(async () => vi.advanceTimersByTime(COPY_FEEDBACK_RESET_MS));
    expect(result.current.status).toBe(COPY_STATUS.Failed);
  });

  it('clears the reset timer and skips state updates after unmount', async () => {
    let finish: (() => void) | undefined;
    writeText.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() => useCopyFeedback());
    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = result.current.copy('a');
    });
    unmount();
    await act(async () => {
      finish?.();
      await pending;
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
