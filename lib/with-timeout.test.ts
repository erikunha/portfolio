import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadTimeoutError, SSR_REDIS_TIMEOUT_MS, withTimeout } from './with-timeout';

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('returns the read when it answers in time', async () => {
    await expect(withTimeout(async () => 'ok')).resolves.toBe('ok');
  });

  it('rejects with ReadTimeoutError when the read hangs past the bound', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(() => new Promise<never>(() => undefined));
    const assertion = expect(pending).rejects.toBeInstanceOf(ReadTimeoutError);
    await vi.advanceTimersByTimeAsync(SSR_REDIS_TIMEOUT_MS);
    await assertion;
  });

  it('turns a synchronous throw (an unconfigured client) into a rejection the caller can catch', async () => {
    const unconfigured = () => {
      throw new Error('redis is not configured');
    };
    await expect(withTimeout(unconfigured)).rejects.toThrow('redis is not configured');
  });
});
