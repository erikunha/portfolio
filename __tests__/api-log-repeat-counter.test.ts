import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const RELEASE = 'abc1234';
const WEEK_SECONDS = 604_800;
const set = vi.fn();
const incr = vi.fn();
const expire = vi.fn();
const exec = vi.fn();
const multi = vi.fn();
const standaloneIncr = vi.fn();
const standaloneExpire = vi.fn();
const warn = vi.fn();
const error = vi.fn();

function post(): Promise<Response> {
  return import('@/app/api/log/route').then(({ POST }) =>
    POST(
      new NextRequest('http://localhost/api/log', {
        method: 'POST',
        body: JSON.stringify({ level: 'error', release: RELEASE, message: 'boom' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

describe('/api/log repeat counter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    const tx = { incr, expire, exec };
    incr.mockReturnValue(tx);
    expire.mockReturnValue(tx);
    exec.mockResolvedValue([2, 1]);
    multi.mockReturnValue(tx);
    set.mockResolvedValue(null);
    vi.doMock('@/lib/redis', () => ({
      getRedis: () => ({ set, multi, incr: standaloneIncr, expire: standaloneExpire }),
    }));
    vi.doMock('@/lib/server/client-ip', () => ({ getClientIp: () => '127.0.0.1' }));
    vi.doMock('@/lib/rate-limit', () => ({
      getErrorLogLimit: () => ({ limit: async () => ({ success: true }) }),
      getErrorLogDailyLimit: () => ({ limit: async () => ({ success: true }) }),
      getErrorLogIpDailyLimit: () => ({ limit: async () => ({ success: true }) }),
    }));
    vi.doMock('@/lib/ip-hash', () => ({ hashIp: async () => 'hashed-ip-test' }));
    vi.doMock('@/lib/log', () => ({ log: { info: vi.fn(), error, warn, debug: vi.fn() } }));
  });

  it('increments and sets the TTL in one transaction', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(multi).toHaveBeenCalledOnce();
    const [countKey] = incr.mock.calls[0] ?? [];
    expect(String(countKey)).toMatch(/^errn:/);
    expect(expire).toHaveBeenCalledWith(countKey, WEEK_SECONDS);
    expect(exec).toHaveBeenCalledOnce();
    expect(standaloneIncr).not.toHaveBeenCalled();
    expect(standaloneExpire).not.toHaveBeenCalled();
  });

  it('keys the counter next to the stored record', async () => {
    await post();
    const [recordKey] = set.mock.calls[0] ?? [];
    const [countKey] = incr.mock.calls[0] ?? [];
    expect(String(countKey)).toBe(String(recordKey).replace(/^err:/, 'errn:'));
  });

  it('answers 200 and warns when only the counter transaction fails', async () => {
    exec.mockRejectedValueOnce(new Error('kv down'));
    const res = await post();
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('still answers 503 when the record write itself fails', async () => {
    set.mockRejectedValueOnce(new Error('kv down'));
    const res = await post();
    expect(res.status).toBe(503);
    expect(multi).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });

  it('opens no counter transaction for the first record of a fingerprint', async () => {
    set.mockResolvedValueOnce('OK');
    const res = await post();
    expect(res.status).toBe(200);
    expect(multi).not.toHaveBeenCalled();
  });
});
