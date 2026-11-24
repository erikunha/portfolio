import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lpush = vi.fn();
const ltrim = vi.fn();
const expire = vi.fn();
const exec = vi.fn();
const minuteLimit = vi.fn();
const ipDailyLimit = vi.fn();
const dailyLimit = vi.fn();
const logWarn = vi.fn();

function chain() {
  const tx = {
    lpush: (...args: unknown[]) => {
      lpush(...args);
      return tx;
    },
    ltrim: (...args: unknown[]) => {
      ltrim(...args);
      return tx;
    },
    expire: (...args: unknown[]) => {
      expire(...args);
      return tx;
    },
    exec: () => exec(),
  };
  return tx;
}

vi.mock('@/lib/redis', () => ({ getRedis: vi.fn(() => ({ multi: chain })) }));
vi.mock('@/lib/server/client-ip', () => ({ getClientIp: vi.fn(() => '203.0.113.7') }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip') }));
vi.mock('@/lib/rate-limit', async () =>
  (await import('@/__tests__/helpers/ask-route')).rateLimitModule({
    getVitalsLimit: vi.fn(() => ({ limit: minuteLimit })),
    getVitalsIpDailyLimit: vi.fn(() => ({ limit: ipDailyLimit })),
    getVitalsDailyLimit: vi.fn(() => ({ limit: dailyLimit })),
  }),
);
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: logWarn, debug: vi.fn() },
}));

const VALID = {
  path: '/pt/cv',
  vw: 390,
  release: 'abc1234',
  metrics: [
    {
      name: 'LCP',
      value: 3100,
      ttfb: 400,
      loadDelay: 100,
      loadDuration: 300,
      renderDelay: 2300,
      tag: 'h1',
      landmark: 'bio',
      nav: 'navigate',
    },
    {
      name: 'INP',
      value: 260,
      input: 'pointer',
      inputDelay: 20,
      processing: 200,
      presentation: 40,
      tag: 'button',
      landmark: 'sec-contact',
      loadState: 'complete',
    },
    { name: 'CLS', value: 0.0312, tag: 'img', landmark: 'bio' },
  ],
};

function post(body: unknown, init: { raw?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest('http://localhost/api/vitals', {
    method: 'POST',
    body: init.raw ?? JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

async function call(request: NextRequest) {
  const { POST } = await import('@/app/api/vitals/route');
  return POST(request);
}

function storedRecords(): Record<string, unknown>[] {
  const [, ...serialized] = lpush.mock.calls[0] as [string, ...string[]];
  return serialized.map((entry) => JSON.parse(entry));
}

describe('POST /api/vitals', () => {
  beforeEach(() => {
    vi.resetModules();
    for (const spy of [
      lpush,
      ltrim,
      expire,
      exec,
      minuteLimit,
      ipDailyLimit,
      dailyLimit,
      logWarn,
    ]) {
      spy.mockReset();
    }
    minuteLimit.mockResolvedValue({ success: true });
    ipDailyLimit.mockResolvedValue({ success: true });
    dailyLimit.mockResolvedValue({ success: true });
    exec.mockResolvedValue([]);
  });

  it('stores one compact record per metric under the weekly key with a 21 day TTL and a cap', async () => {
    const res = await call(post(VALID));

    expect(res.status).toBe(200);
    const key = lpush.mock.calls[0]?.[0];
    expect(key).toMatch(/^vitals:\d{4}-W\d{2}$/);
    expect(ltrim).toHaveBeenCalledWith(key, 0, 5999);
    expect(expire).toHaveBeenCalledWith(key, 21 * 24 * 3600);
    expect(storedRecords()).toEqual([
      {
        name: 'LCP',
        value: 3100,
        route: 'cv',
        locale: 'pt',
        device: 'mobile',
        release: 'abc1234',
        nav: 'navigate',
        el: 'h1@bio',
        parts: { ttfb: 400, loadDelay: 100, loadDuration: 300, renderDelay: 2300 },
      },
      {
        name: 'INP',
        value: 260,
        route: 'cv',
        locale: 'pt',
        device: 'mobile',
        release: 'abc1234',
        el: 'button@sec-contact',
        input: 'pointer',
        loadState: 'complete',
        parts: { inputDelay: 20, processing: 200, presentation: 40 },
      },
      {
        name: 'CLS',
        value: 0.0312,
        route: 'cv',
        locale: 'pt',
        device: 'mobile',
        release: 'abc1234',
        el: 'img@bio',
      },
    ]);
  });

  it('keeps no path, query, address, user agent or hash in any stored record', async () => {
    await call(
      post(
        { ...VALID, path: '/cv?token=secret-value' },
        { headers: { 'User-Agent': 'Mozilla/5.0 UniqueAgent', 'x-forwarded-for': '203.0.113.7' } },
      ),
    );

    const stored = JSON.stringify(storedRecords());
    for (const fragment of ['secret-value', 'token', '203.0.113.7', 'UniqueAgent', 'hashed-ip']) {
      expect(stored).not.toContain(fragment);
    }
  });

  it('reduces an unknown tag or landmark to other so labels stay a bounded set', async () => {
    await call(
      post({
        path: '/',
        vw: 1280,
        metrics: [{ name: 'CLS', value: 0.2, tag: 'x-secret-widget', landmark: 'user-4821' }],
      }),
    );

    expect(storedRecords()[0]).toMatchObject({
      el: 'other@other',
      route: 'home',
      device: 'desktop',
    });
  });

  it('files a path outside the known routes under other', async () => {
    await call(post({ path: '/some/deep/page', vw: 1024, metrics: [{ name: 'CLS', value: 0 }] }));

    expect(storedRecords()[0]).toMatchObject({ route: 'other', locale: 'en' });
  });

  it.each([
    ['an unknown metric', { ...VALID, metrics: [{ name: 'FCP', value: 1 }] }],
    ['no metrics', { ...VALID, metrics: [] }],
    ['a repeated metric', { ...VALID, metrics: [VALID.metrics[2], VALID.metrics[2]] }],
    ['a negative value', { ...VALID, metrics: [{ name: 'CLS', value: -1 }] }],
    ['a value past the cap', { ...VALID, metrics: [{ name: 'CLS', value: 1e9 }] }],
    ['an LCP without its subparts', { ...VALID, metrics: [{ name: 'LCP', value: 100 }] }],
    ['a missing path', { vw: 1, metrics: VALID.metrics }],
  ])('answers 400 and writes nothing for %s', async (_label, body) => {
    const res = await call(post(body));

    expect(res.status).toBe(400);
    expect(lpush).not.toHaveBeenCalled();
  });

  it('answers 400 for a body that is not JSON', async () => {
    const res = await call(post(undefined, { raw: '{not json' }));

    expect(res.status).toBe(400);
    expect(lpush).not.toHaveBeenCalled();
  });

  it('answers 413 past the 2 KB body cap before parsing', async () => {
    const res = await call(post({ ...VALID, release: 'x'.repeat(4096) }));

    expect(res.status).toBe(413);
    expect(lpush).not.toHaveBeenCalled();
  });

  it('answers 429 and writes nothing when the per-minute limit rejects', async () => {
    minuteLimit.mockResolvedValue({ success: false, reset: Date.now() + 1000 });

    const res = await call(post(VALID));

    expect(res.status).toBe(429);
    expect(ipDailyLimit).not.toHaveBeenCalled();
    expect(lpush).not.toHaveBeenCalled();
  });

  it('refuses a cross-site request before touching Redis', async () => {
    const res = await call(post(VALID, { headers: { 'Sec-Fetch-Site': 'cross-site' } }));

    expect(res.status).toBe(403);
    expect(minuteLimit).not.toHaveBeenCalled();
    expect(lpush).not.toHaveBeenCalled();
  });

  it.each([
    ['per-IP daily', () => ipDailyLimit.mockResolvedValue({ success: false })],
    ['global daily', () => dailyLimit.mockResolvedValue({ success: false })],
  ])('drops the record and still answers ok past the %s cap', async (_label, trip) => {
    trip();

    const res = await call(post(VALID));

    expect(res.status).toBe(200);
    expect(lpush).not.toHaveBeenCalled();
  });

  it('records anyway when a daily cap check throws', async () => {
    ipDailyLimit.mockRejectedValue(new Error('redis down'));
    dailyLimit.mockRejectedValue(new Error('redis down'));

    const res = await call(post(VALID));

    expect(res.status).toBe(200);
    expect(lpush).toHaveBeenCalledTimes(1);
    expect(logWarn).toHaveBeenCalledTimes(2);
  });

  it('answers 503 storage_unavailable when the write fails', async () => {
    exec.mockRejectedValue(new Error('redis down'));

    const res = await call(post(VALID));

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: 'storage_unavailable' } });
  });
});
