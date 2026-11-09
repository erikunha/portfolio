import { vi } from 'vitest';

const TIMEOUT_REASON_NAME = 'TimeoutError';

export function driveAbortTimeoutWithFakeTimers(): void {
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('timed out', TIMEOUT_REASON_NAME)), ms);
    return controller.signal;
  });
}

export function stalledUntilAborted(
  _payload: unknown,
  options?: { signal?: AbortSignal },
): Promise<never> {
  return new Promise((_, reject) => {
    options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
  });
}
