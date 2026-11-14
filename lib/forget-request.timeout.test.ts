import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const A = '11111111-1111-4111-8111-111111111111';

async function load() {
  vi.resetModules();
  return import('./forget-request.client');
}

function hangUntilAborted() {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }),
  );
}

describe('forgetRequest when the server never answers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports timed-out, not offline, because the request may have reached the server', async () => {
    const forget = await load();
    vi.stubGlobal('fetch', hangUntilAborted());
    const pending = forget.forgetRequest(A);
    await vi.advanceTimersByTimeAsync(forget.FORGET_TIMEOUT_MS);
    expect(await pending).toEqual({ outcome: forget.FORGET_OUTCOME.TimedOut });
  });

  it('keeps the id in the session list so the visitor can retry it', async () => {
    const forget = await load();
    const refs = await import('./request-refs.client');
    refs.addRef(A);
    vi.stubGlobal('fetch', hangUntilAborted());
    const pending = forget.forgetRequest(A);
    await vi.advanceTimersByTimeAsync(forget.FORGET_TIMEOUT_MS);
    await pending;
    expect(refs.listRefs()).toEqual([A]);
  });

  it('still reports offline when the request fails before the deadline', async () => {
    const forget = await load();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(await forget.forgetRequest(A)).toEqual({ outcome: forget.FORGET_OUTCOME.Offline });
  });
});
