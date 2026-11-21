import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorStore } from '@/__tests__/helpers/error-store';

const MAX_DIGEST_LENGTH = 64;
const MAX_MOTION_LENGTH = 16;
const RECORD_KEY_PREFIX = 'err:';
const store = createErrorStore();

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

function storedRecord(): Record<string, unknown> {
  const key = [...store.values.keys()].find((name) => name.startsWith(RECORD_KEY_PREFIX));
  return JSON.parse(String(store.values.get(key ?? ''))) as Record<string, unknown>;
}

describe('/api/log with context fields the server cannot accept', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    store.reset();
    vi.doMock('@/lib/redis', () => ({ getRedis: () => store.redis() }));
    vi.doMock('@/lib/server/client-ip', () => ({ getClientIp: () => '127.0.0.1' }));
    vi.doMock('@/lib/rate-limit', () => ({
      getErrorLogLimit: () => ({ limit: async () => ({ success: true }) }),
      getErrorLogDailyLimit: () => ({ limit: async () => ({ success: true }) }),
      getErrorLogIpDailyLimit: () => ({ limit: async () => ({ success: true }) }),
    }));
    vi.doMock('@/lib/ip-hash', () => ({ hashIp: async () => 'hashed-ip-test' }));
    vi.doMock('@/lib/log', async () => (await import('@/__tests__/helpers/modules')).logModule());
  });

  it('stores the report without an oversize digest', async () => {
    const res = await post({ digest: 'd'.repeat(MAX_DIGEST_LENGTH + 1), motion: 'on' });
    expect(res.status).toBe(200);
    const record = storedRecord();
    expect(record.digest).toBeUndefined();
    expect(record.motion).toBe('on');
    expect(record.message).toBe('boom');
  });

  it('stores the report without an oversize motion value', async () => {
    const res = await post({ motion: 'm'.repeat(MAX_MOTION_LENGTH + 1), digest: '2918476530' });
    expect(res.status).toBe(200);
    const record = storedRecord();
    expect(record.motion).toBeUndefined();
    expect(record.digest).toBe('2918476530');
  });

  it.each([
    ['digest', 42],
    ['motion', { on: true }],
  ])('stores the report without a %s that is not a string', async (field, value) => {
    const res = await post({ [field]: value });
    expect(res.status).toBe(200);
    expect(storedRecord()[field]).toBeUndefined();
  });

  it('keeps a digest and a motion value at their length limits', async () => {
    const digest = 'd'.repeat(MAX_DIGEST_LENGTH);
    const motion = 'm'.repeat(MAX_MOTION_LENGTH);
    const res = await post({ digest, motion });
    expect(res.status).toBe(200);
    expect(storedRecord().digest).toBe(digest);
    expect(storedRecord().motion).toBe(motion);
  });

  it('still refuses a report whose message is missing', async () => {
    const res = await post({ message: '' });
    expect(res.status).toBe(400);
    expect(store.values.size).toBe(0);
  });
});
