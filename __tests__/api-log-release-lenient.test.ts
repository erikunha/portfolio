import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const UNKNOWN_SEGMENT = 'unknown';
const OVERSIZED_RELEASE = 'r'.repeat(41);
const set = vi.fn();

function post(body: Record<string, unknown>): Promise<Response> {
  return import('@/app/api/log/route').then(({ POST }) =>
    POST(
      new NextRequest('http://localhost/api/log', {
        method: 'POST',
        body: JSON.stringify({ level: 'error', message: 'boom', ...body }),
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

describe('/api/log with a release the server cannot accept', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    set.mockResolvedValue('OK');
    vi.doMock('@/lib/redis', () => ({
      getRedis: () => ({ set, incr: vi.fn(), expire: vi.fn() }),
    }));
    vi.doMock('@/lib/server/client-ip', () => ({ getClientIp: () => '127.0.0.1' }));
    vi.doMock('@/lib/rate-limit', () => ({
      getErrorLogLimit: () => ({ limit: async () => ({ success: true }) }),
      getErrorLogDailyLimit: () => ({ limit: async () => ({ success: true }) }),
      getErrorLogIpDailyLimit: () => ({ limit: async () => ({ success: true }) }),
    }));
    vi.doMock('@/lib/ip-hash', () => ({ hashIp: async () => 'hashed-ip-test' }));
    vi.doMock('@/lib/log', () => ({
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
  });

  it.each([
    ['a colon', 'a:b'],
    ['a scan wildcard', 'a*'],
    ['a space', 'a b'],
    ['a character class', 'a[0-9]'],
    ['an empty string', ''],
    ['more than 40 characters', OVERSIZED_RELEASE],
  ])('stores the report with the release cleared when it has %s', async (_name, release) => {
    const res = await post({ release });
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledOnce();
    const [key, value] = set.mock.calls[0] ?? [];
    expect(String(key).split(':')[1]).toBe(UNKNOWN_SEGMENT);
    const record = JSON.parse(String(value)) as Record<string, unknown>;
    expect('release' in record).toBe(false);
    expect(record.message).toBe('boom');
  });

  it('stores a report whose release is not a string with the release cleared', async () => {
    const res = await post({ release: 42 });
    expect(res.status).toBe(200);
    const [key] = set.mock.calls[0] ?? [];
    expect(String(key).split(':')[1]).toBe(UNKNOWN_SEGMENT);
  });

  it('still refuses a report that has no message', async () => {
    const res = await post({ message: '', release: 'a:b' });
    expect(res.status).toBe(400);
    expect(set).not.toHaveBeenCalled();
  });
});
