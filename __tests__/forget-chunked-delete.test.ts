import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askRequest } from './helpers/ask-route';

const TARGET = '11111111-2222-4333-8444-555555555555';
const CONVERSATION = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';
const TARGET_KEY = `ask:log:2026-11-12:${TARGET}`;
const INDEX_KEY = `ask:conv:${CONVERSATION}`;
const MEMBER_COUNT = 250;
const NOW = new Date('2026-11-13T12:00:00.000Z');

const del = vi.fn(async (...keys: string[]) => {
  return keys.length;
});
const mget = vi.fn();
const smembers = vi.fn();
const removePendingContact = vi.fn();

function member(index: number): string {
  const suffix = String(index).padStart(12, '0');
  return `ask:log:2026-11-10:00000000-0000-4000-8000-${suffix}`;
}

async function forget(): Promise<Response> {
  const { POST } = await import('@/app/api/log/forget/route');
  return POST(askRequest({ requestId: TARGET }, { url: 'http://localhost/api/log/forget' }));
}

describe('/api/log/forget on a large conversation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    for (const fn of [del, mget, smembers, removePendingContact]) fn.mockClear();
    mget.mockImplementation(async (...keys: string[]) =>
      keys.map((key) =>
        key === TARGET_KEY ? { requestId: TARGET, conversationId: CONVERSATION } : null,
      ),
    );
    smembers.mockResolvedValue(Array.from({ length: MEMBER_COUNT }, (_unused, i) => member(i)));
    vi.doMock('@/lib/rate-limit', () => ({
      getClientIp: vi.fn(() => '127.0.0.1'),
      getForgetLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
      getRedis: vi.fn(() => ({ del, mget, smembers, set: vi.fn(async () => 'OK') })),
    }));
    vi.doMock('@/lib/contact-outbox', () => ({
      contactMessageKey: (id: string) => `contact:msg:${id}`,
      removePendingContact,
    }));
    vi.doMock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
    vi.doMock('@/lib/log', () => ({
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
  });

  it('splits the delete into several calls and still deletes every key', async () => {
    const res = await forget();

    expect(res.status).toBe(200);
    expect(del.mock.calls.length).toBeGreaterThan(1);
    const deleted = del.mock.calls.flat().map(String);
    for (let i = 0; i < MEMBER_COUNT; i += 1) expect(deleted).toContain(member(i));
    expect(deleted).toContain(INDEX_KEY);
    expect(deleted).toContain(`contact:msg:${TARGET}`);
    expect(new Set(deleted).size).toBe(deleted.length);
  });
});
