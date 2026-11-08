import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKOFF_BASE_MS, BACKOFF_MAX_MS } from '@/lib/error-bridge.client';

const BRIDGE_STATE_KEY = Symbol.for('erikunha.dev/error-bridge');
const DEDUP_CLEAR_MS = 150;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_NO_CONTENT = 204;

function fireError(message: string): void {
  const event = Object.assign(new Event('error'), {
    message,
    error: new Error(message),
  }) as ErrorEvent;
  window.dispatchEvent(event);
}

const responses: Array<() => Response> = [];
const fetchSpy = vi.fn(
  async () => responses.shift()?.() ?? new Response(null, { status: HTTP_NO_CONTENT }),
);

describe('backoff after a refused or failed report', () => {
  beforeEach(() => {
    const state = (window as unknown as Record<symbol, Record<string, unknown> | undefined>)[
      BRIDGE_STATE_KEY
    ];
    if (state) Object.assign(state, { failures: 0, blockedUntil: 0, reported: 0 });
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    fetchSpy.mockClear();
    responses.length = 0;
  });

  it('drops reports during the backoff after a 429 and resumes once it ends', async () => {
    responses.push(() => new Response(null, { status: HTTP_TOO_MANY_REQUESTS }));
    fireError('backoff-first');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fireError('backoff-during');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS);
    fireError('backoff-after');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('doubles the wait on consecutive failures, up to the ceiling', async () => {
    responses.push(
      () => new Response(null, { status: HTTP_TOO_MANY_REQUESTS }),
      () => new Response(null, { status: HTTP_TOO_MANY_REQUESTS }),
    );
    fireError('double-1');
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS + DEDUP_CLEAR_MS);
    fireError('double-2');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS);
    fireError('double-3');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(BACKOFF_MAX_MS);
    fireError('double-4');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('honours a Retry-After longer than the computed wait', async () => {
    const retryAfterSeconds = (BACKOFF_BASE_MS / 1000) * 10;
    responses.push(
      () =>
        new Response(null, {
          status: HTTP_TOO_MANY_REQUESTS,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }),
    );
    fireError('retry-after-1');
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 5);
    fireError('retry-after-2');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 6);
    fireError('retry-after-3');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('backs off after a network failure and clears the penalty on success', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('network down'));
    fireError('net-1');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    fireError('net-2');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS);
    fireError('net-3');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    fireError('net-4');
    await vi.advanceTimersByTimeAsync(DEDUP_CLEAR_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
