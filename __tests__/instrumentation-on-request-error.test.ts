import { beforeEach, describe, expect, it, vi } from 'vitest';

const errorLog = vi.hoisted(() =>
  vi.fn<(message: string, ctx: Record<string, unknown>) => unknown>(),
);
vi.mock('@/lib/log', async () =>
  (await import('./helpers/modules')).logModule({ error: errorLog }),
);

const SECRET_MESSAGE = 'user typed jane@example.com into the form';
const REQUEST_PATH = '/api/ask';
const REQUEST_QUERY = '?token=abc123';

const request = {
  path: `${REQUEST_PATH}${REQUEST_QUERY}`,
  method: 'POST',
  headers: { cookie: 'session=secret', authorization: 'Bearer secret' },
};

const context = {
  routerKind: 'App Router',
  routePath: '/app/api/ask',
  routeType: 'route',
  renderSource: 'react-server-components',
  revalidateReason: undefined,
  renderType: 'dynamic',
} as const;

async function loadHook() {
  const mod = await import('../instrumentation');
  return mod.onRequestError as (e: unknown, r: typeof request, c: typeof context) => Promise<void>;
}

describe('onRequestError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs the digest, path without query, router, route, source and method once', async () => {
    const onRequestError = await loadHook();
    const error = Object.assign(new TypeError(SECRET_MESSAGE), { digest: 'd1g3st' });

    await onRequestError(error, request, context);

    expect(errorLog).toHaveBeenCalledTimes(1);
    const ctx = errorLog.mock.lastCall?.[1];
    expect(ctx).toEqual({
      digest: 'd1g3st',
      errorName: 'TypeError',
      path: REQUEST_PATH,
      method: 'POST',
      routerKind: 'App Router',
      routePath: '/app/api/ask',
      routeType: 'route',
      renderSource: 'react-server-components',
    });
  });

  it('never logs headers, the query string or the error message', async () => {
    const onRequestError = await loadHook();
    await onRequestError(new Error(SECRET_MESSAGE), request, context);

    const serialized = JSON.stringify(errorLog.mock.calls);
    for (const leaked of ['secret', 'abc123', 'jane@example.com', 'cookie']) {
      expect(serialized).not.toContain(leaked);
    }
  });

  it('tolerates a thrown non-error value', async () => {
    const onRequestError = await loadHook();
    await onRequestError('boom', request, context);

    const ctx = errorLog.mock.lastCall?.[1];
    expect(ctx?.errorName).toBe('UnknownError');
    expect(ctx?.digest).toBeUndefined();
  });

  it('awaits the logger before resolving', async () => {
    let finished = false;
    errorLog.mockImplementationOnce(async () => {
      await Promise.resolve();
      finished = true;
    });
    const onRequestError = await loadHook();
    await onRequestError(new Error('x'), request, context);
    expect(finished).toBe(true);
  });
});
