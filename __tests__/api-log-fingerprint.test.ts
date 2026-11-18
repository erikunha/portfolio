import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorFingerprint } from '@/lib/error-fingerprint';

const RELEASE = 'abc1234';
const WEEK_SECONDS = 604_800;
const KEY_PARTS = 4;
const incr = vi.fn();
const expire = vi.fn();
const exec = vi.fn();
const multi = vi.fn();
const set = vi.fn();

function post(body: Record<string, unknown>): Promise<Response> {
  return import('@/app/api/log/route').then(({ POST }) =>
    POST(
      new NextRequest('http://localhost/api/log', {
        method: 'POST',
        body: JSON.stringify({ level: 'error', release: RELEASE, ...body }),
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

describe('/api/log fingerprint dedupe', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    set.mockResolvedValue('OK');
    const tx = { incr, expire, exec };
    incr.mockReturnValue(tx);
    expire.mockReturnValue(tx);
    exec.mockResolvedValue([1, 1]);
    multi.mockReturnValue(tx);
    vi.doMock('@/lib/redis', () => ({ getRedis: () => ({ set, multi }) }));
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

  it('writes the first record of a fingerprint with SET NX under a key that ends in the fingerprint', async () => {
    const res = await post({ message: 'boom' });
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledOnce();
    const [key, , options] = set.mock.calls[0] ?? [];
    const parts = String(key).split(':');
    expect(parts).toHaveLength(KEY_PARTS);
    expect(parts[3]).toBe(errorFingerprint({ message: 'boom' }));
    expect(options).toEqual({ ex: WEEK_SECONDS, nx: true });
    expect(incr).not.toHaveBeenCalled();
  });

  it('counts a repeat of the same fingerprint instead of storing a second record', async () => {
    set.mockResolvedValueOnce(null);
    const res = await post({ message: 'boom' });
    expect(res.status).toBe(200);
    expect(incr).toHaveBeenCalledOnce();
    const [countKey] = incr.mock.calls[0] ?? [];
    const [recordKey] = set.mock.calls[0] ?? [];
    expect(String(countKey)).toBe(String(recordKey).replace(/^err:/, 'errn:'));
    expect(expire).toHaveBeenCalledWith(countKey, WEEK_SECONDS);
    expect(exec).toHaveBeenCalledOnce();
  });

  it('files two different messages under two keys', async () => {
    await post({ message: 'boom' });
    await post({ message: 'bang' });
    const [first] = set.mock.calls[0] ?? [];
    const [second] = set.mock.calls[1] ?? [];
    expect(first).not.toBe(second);
  });

  it('answers 200 when the counter write fails after the record was stored', async () => {
    set.mockResolvedValueOnce(null);
    exec.mockRejectedValueOnce(new Error('kv down'));
    const res = await post({ message: 'boom' });
    expect(res.status).toBe(200);
  });
});
