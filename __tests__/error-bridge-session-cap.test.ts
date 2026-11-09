import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_REPORTS_PER_SESSION } from '@/lib/error-bridge.client';

const OVER_CAP = 25;
const DEDUP_CLEAR_MS = 150;

function fireError(message: string): void {
  const event = Object.assign(new Event('error'), {
    message,
    error: new Error(message),
  }) as ErrorEvent;
  window.dispatchEvent(event);
}

describe('per-session report cap', () => {
  const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    fetchSpy.mockClear();
  });

  it('stops posting once the session has sent its cap of distinct reports', async () => {
    for (let i = 0; i < MAX_REPORTS_PER_SESSION + OVER_CAP; i++) {
      fireError(`cap-distinct-${i}`);
      await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(MAX_REPORTS_PER_SESSION);
  });

  it('keeps the cap shared with the error boundary reporter', async () => {
    const { reportClientError } = await import('@/lib/report-client-error.client');
    reportClientError('boundary', new Error('after the cap'));
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
