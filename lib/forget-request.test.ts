import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

async function load() {
  vi.resetModules();
  const refs = await import('./request-refs.client');
  const forget = await import('./forget-request.client');
  return { refs, forget };
}

function respond(status: number, headers: Record<string, string> = {}) {
  return vi.fn(async () => Response.json({ ok: status === 200 }, { status, headers }));
}

describe('forgetRequest', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the id to the forget endpoint and reports deleted on 200, dropping it from the session list', async () => {
    const { refs, forget } = await load();
    refs.addRef(A);
    const fetchMock = respond(200);
    vi.stubGlobal('fetch', fetchMock);
    const result = await forget.forgetRequest(A);
    expect(result).toEqual({ outcome: forget.FORGET_OUTCOME.Deleted });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/log/forget',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ requestId: A }) }),
    );
    expect(refs.listRefs()).toEqual([]);
  });

  it('reports failed on 404, because the endpoint answers 200 for an unknown id and a 404 means a wrong route', async () => {
    const { refs, forget } = await load();
    refs.addRef(A);
    vi.stubGlobal('fetch', respond(404));
    expect(await forget.forgetRequest(A)).toEqual({ outcome: forget.FORGET_OUTCOME.Failed });
    expect(refs.listRefs()).toEqual([A]);
  });

  it('reports rate-limited with the Retry-After seconds on 429 and keeps the id', async () => {
    const { refs, forget } = await load();
    refs.addRef(A);
    vi.stubGlobal('fetch', respond(429, { 'Retry-After': '120' }));
    expect(await forget.forgetRequest(A)).toEqual({
      outcome: forget.FORGET_OUTCOME.RateLimited,
      retryAfter: 120,
    });
    expect(refs.listRefs()).toEqual([A]);
  });

  it('reports rate-limited with a null retryAfter when the header is missing or invalid', async () => {
    const { forget } = await load();
    vi.stubGlobal('fetch', respond(429, { 'Retry-After': 'soon' }));
    expect(await forget.forgetRequest(A)).toEqual({
      outcome: forget.FORGET_OUTCOME.RateLimited,
      retryAfter: null,
    });
  });

  it.each([400, 500, 503])('reports failed on %i and keeps the id', async (status) => {
    const { refs, forget } = await load();
    refs.addRef(A);
    vi.stubGlobal('fetch', respond(status));
    expect(await forget.forgetRequest(A)).toEqual({ outcome: forget.FORGET_OUTCOME.Failed });
    expect(refs.listRefs()).toEqual([A]);
  });

  it('reports failed on a network error', async () => {
    const { forget } = await load();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    expect(await forget.forgetRequest(A)).toEqual({ outcome: forget.FORGET_OUTCOME.Failed });
  });
});

describe('forgetMany', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forgets ids one at a time, in order, with one result per id', async () => {
    const { forget } = await load();
    let inFlight = 0;
    let maxInFlight = 0;
    const order: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        order.push((JSON.parse(String(init.body)) as { requestId: string }).requestId);
        await Promise.resolve();
        inFlight -= 1;
        return Response.json({ ok: true });
      }),
    );
    const batch = await forget.forgetMany([A, B, C]);
    expect(order).toEqual([A, B, C]);
    expect(maxInFlight).toBe(1);
    expect(batch.results.map((entry) => entry.id)).toEqual([A, B, C]);
    expect(batch.unattempted).toEqual([]);
  });

  it('stops at the first 429 and returns the ids it did not try', async () => {
    const { forget } = await load();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(
        Response.json({ ok: false }, { status: 429, headers: { 'Retry-After': '60' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const batch = await forget.forgetMany([A, B, C]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(batch.results.map((entry) => entry.result.outcome)).toEqual([
      forget.FORGET_OUTCOME.Deleted,
      forget.FORGET_OUTCOME.RateLimited,
    ]);
    expect(batch.unattempted).toEqual([C]);
  });

  it('does not stop on a plain failure', async () => {
    const { forget } = await load();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ok: false }, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const batch = await forget.forgetMany([A, B]);
    expect(batch.results.map((entry) => entry.result.outcome)).toEqual([
      forget.FORGET_OUTCOME.Failed,
      forget.FORGET_OUTCOME.Deleted,
    ]);
  });

  it('makes no request for an empty list', async () => {
    const { forget } = await load();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await forget.forgetMany([])).toEqual({ results: [], unattempted: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
