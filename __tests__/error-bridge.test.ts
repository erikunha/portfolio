// __tests__/error-bridge.test.ts
// Behavioral tests for error-bridge exported utilities.
// Locks down: buildLogPayload shape; dedup window (second emission within
// DEDUP_TAIL_MS is suppressed); MAX_DEDUP_SIZE FIFO eviction.
//
// Design note: the module attaches window event listeners on import as a
// side effect. vi.resetModules() + re-import accumulates additional listeners
// on the shared jsdom window without removing old ones. All tests therefore
// share the single static import to keep exactly one listener active and avoid
// listener fan-out inflating fetch call counts. Each test uses a globally
// unique error message so the shared dedup Map does not cause cross-test
// contamination.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLogPayload, type LogPayload, MAX_DEDUP_SIZE } from '@/lib/error-bridge.client';

// ─── buildLogPayload ──────────────────────────────────────────────────────────

describe('buildLogPayload', () => {
  it('returns level="error", message, and an ISO ts string', () => {
    const payload: LogPayload = buildLogPayload('boom', undefined);
    expect(payload.level).toBe('error');
    expect(payload.message).toBe('boom');
    expect(typeof payload.ts).toBe('string');
    expect(new Date(payload.ts).getTime()).not.toBeNaN();
  });

  it('includes stack when provided', () => {
    const payload = buildLogPayload('err', 'at foo (bar:1:1)');
    expect(payload.stack).toBe('at foo (bar:1:1)');
  });

  it('omits stack when not provided', () => {
    const payload = buildLogPayload('err', undefined);
    expect('stack' in payload).toBe(false);
  });

  it('includes url and userAgent from window in jsdom context', () => {
    const payload = buildLogPayload('err', undefined);
    expect(typeof payload.url).toBe('string');
    expect(typeof payload.userAgent).toBe('string');
  });
});

// ─── MAX_DEDUP_SIZE ───────────────────────────────────────────────────────────

describe('MAX_DEDUP_SIZE', () => {
  it('is exported and is a positive integer (FIFO eviction cap)', () => {
    expect(typeof MAX_DEDUP_SIZE).toBe('number');
    expect(MAX_DEDUP_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_DEDUP_SIZE)).toBe(true);
  });
});

// ─── dedup — window error event behavior ─────────────────────────────────────
// All tests share the single static module import (one listener on window).
// Unique message keys per test prevent cross-test dedup Map contamination.

describe('dedup — window error event behavior', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let fetchCalls: Array<{ message: string }> = [];

  beforeEach(() => {
    fetchCalls = [];
    fetchSpy = vi.fn(async (_url: string, opts: RequestInit) => {
      fetchCalls.push(JSON.parse(opts.body as string) as { message: string });
      return new Response('', { status: 204 });
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // Fire an error event backed by a specific Error instance. Reusing the same
  // Error object across multiple dispatches ensures the stack string is
  // identical, which is required for the dedup key to match on repeat fires.
  const fireErrorWithInstance = (message: string, err: Error) => {
    const event = Object.assign(new Event('error'), {
      message,
      error: err,
    }) as ErrorEvent;
    window.dispatchEvent(event);
  };

  it('posts the first error event', async () => {
    const err = new Error('bridge-unique-1');
    fireErrorWithInstance('bridge-unique-1', err);
    await new Promise<void>((r) => setTimeout(r, 10));
    expect(fetchCalls.filter((p) => p.message === 'bridge-unique-1')).toHaveLength(1);
  });

  it('deduplicates the same error fired twice within 100ms', async () => {
    // Reuse the same Error instance so the stack string — which is part of
    // the dedup key — is identical for both dispatches.
    const err = new Error('bridge-dup-1');
    fireErrorWithInstance('bridge-dup-1', err);
    fireErrorWithInstance('bridge-dup-1', err);
    await new Promise<void>((r) => setTimeout(r, 20));
    expect(fetchCalls.filter((p) => p.message === 'bridge-dup-1')).toHaveLength(1);
  });

  it('allows the same error to be re-emitted after the 100ms dedup window elapses', async () => {
    vi.useFakeTimers();
    const err = new Error('bridge-refire-1');
    fireErrorWithInstance('bridge-refire-1', err);
    // Advance past the 100ms dedup tail window
    vi.advanceTimersByTime(150);
    fireErrorWithInstance('bridge-refire-1', err);
    await vi.runAllTimersAsync();
    expect(fetchCalls.filter((p) => p.message === 'bridge-refire-1')).toHaveLength(2);
  });
});

// ─── dedup — FIFO eviction at MAX_DEDUP_SIZE ─────────────────────────────────

describe('dedup — FIFO eviction at MAX_DEDUP_SIZE', () => {
  let fetchCalls: Array<{ message: string }> = [];

  beforeEach(() => {
    fetchCalls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, opts: RequestInit) => {
        fetchCalls.push(JSON.parse(opts.body as string) as { message: string });
        return new Response('', { status: 204 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('evicts the oldest entry when the map is full, allowing that key to be re-emitted', async () => {
    // Freeze time so none of the entries expire via the stale-entry cleanup
    // loop (now - ts > DEDUP_TAIL_MS). This isolates the FIFO eviction path.
    vi.useFakeTimers();

    const prefix = 'fifo-evict-';

    const fireErrorWithInstance = (message: string, err: Error) => {
      const event = Object.assign(new Event('error'), {
        message,
        error: err,
      }) as ErrorEvent;
      window.dispatchEvent(event);
    };

    // Track the Error for `${prefix}0` so we can reuse the same stack on the
    // re-fire — the dedup key includes the stack string, so both fires must
    // share the same Error instance to produce a matching key after eviction.
    let firstError: Error | null = null;

    // Fill the dedup map with MAX_DEDUP_SIZE unique keys. The first entry
    // inserted will be `${prefix}0` — it becomes the oldest (FIFO head).
    for (let i = 0; i < MAX_DEDUP_SIZE; i++) {
      const msg = `${prefix}${i}`;
      const err = new Error(msg);
      if (i === 0) firstError = err;
      fireErrorWithInstance(msg, err);
    }

    // Firing one more unique key triggers FIFO eviction of `${prefix}0`.
    fireErrorWithInstance(`${prefix}trigger`, new Error(`${prefix}trigger`));

    // `${prefix}0` was evicted — re-firing with the same Error instance
    // (same stack) must bypass the dedup check and produce a second fetch call.
    const evictedMsg = `${prefix}0`;
    // biome-ignore lint/style/noNonNullAssertion: assigned unconditionally in the loop above
    fireErrorWithInstance(evictedMsg, firstError!);

    await vi.runAllTimersAsync();

    // evictedMsg was emitted once during fill and once after eviction = 2 total.
    expect(fetchCalls.filter((p) => p.message === evictedMsg)).toHaveLength(2);
    // The trigger key itself should have been emitted exactly once.
    expect(fetchCalls.filter((p) => p.message === `${prefix}trigger`)).toHaveLength(1);
  });
});
