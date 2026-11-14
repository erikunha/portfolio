import { afterEach, describe, expect, it, vi } from 'vitest';

const A = '11111111-1111-4111-8111-111111111111';

async function load() {
  vi.resetModules();
  return import('./forget-request.client');
}

describe('forgetRequest tells a storage outage and a lost connection apart', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports unavailable on 503, so the visitor learns nothing was deleted', async () => {
    const forget = await load();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: false }, { status: 503 })),
    );
    expect(await forget.forgetRequest(A)).toEqual({ outcome: forget.FORGET_OUTCOME.Unavailable });
  });

  it('reports offline when the request never reaches the server', async () => {
    const forget = await load();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(await forget.forgetRequest(A)).toEqual({ outcome: forget.FORGET_OUTCOME.Offline });
  });

  it('never counts an outage or a lost connection as forgotten', async () => {
    const forget = await load();
    expect(forget.wasForgotten({ outcome: forget.FORGET_OUTCOME.Unavailable })).toBe(false);
    expect(forget.wasForgotten({ outcome: forget.FORGET_OUTCOME.Offline })).toBe(false);
  });
});
