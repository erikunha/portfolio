import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_KV_TTL_S, askLogDatesInTtl } from '@/lib/ask-log';

const MS_PER_SECOND = 1000;
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe('askLogDatesInTtl', () => {
  it.each([
    ['just after UTC midnight', '2026-11-06T00:00:00.001Z'],
    ['midday', '2026-11-06T12:00:00.000Z'],
    ['just before UTC midnight', '2026-11-06T23:59:59.999Z'],
  ])(
    'covers the key date of every record still alive, %s: a record written at the last instant before expiry has a date the sweep must list',
    (_label, iso) => {
      const now = new Date(iso);
      const dates = askLogDatesInTtl(now);
      const oldestAlive = now.getTime() - ASK_KV_TTL_S * MS_PER_SECOND + 1;
      for (let written = oldestAlive; written <= now.getTime(); written += 3_600_000) {
        expect(dates, `a record written ${dayOf(written)} is alive and must be listed`).toContain(
          dayOf(written),
        );
      }
      expect(dates).toContain(dayOf(oldestAlive));
      expect(dates).toContain(dayOf(now.getTime()));
    },
  );

  it('lists each date once', () => {
    const dates = askLogDatesInTtl(new Date('2026-11-06T12:00:00.000Z'));
    expect(new Set(dates).size).toBe(dates.length);
  });
});

describe('/api/log/forget reaches a key in its final day before expiry', () => {
  const redisDelMock = vi.fn();
  const REAL_UUID = '11111111-2222-4333-8444-555555555555';
  const NOW = new Date('2026-11-06T12:00:00.000Z');

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    redisDelMock.mockReset();
    redisDelMock.mockResolvedValue(1);
    vi.doMock('@/lib/rate-limit', () => ({
      getClientIp: vi.fn(() => '127.0.0.1'),
      getForgetLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
      getRedis: vi.fn(() => ({ del: redisDelMock })),
    }));
    vi.doMock('@/lib/contact-outbox', () => ({
      contactMessageKey: (id: string) => `contact:msg:${id}`,
      removePendingContact: vi.fn(async () => undefined),
    }));
    vi.doMock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
    vi.doMock('@/lib/log', () => ({
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock('@/lib/rate-limit');
    vi.doUnmock('@/lib/contact-outbox');
    vi.doUnmock('@/lib/ip-hash');
    vi.doUnmock('@/lib/log');
  });

  it('deletes the key dated exactly the TTL ago', async () => {
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(
      new NextRequest('http://localhost/api/log/forget', {
        method: 'POST',
        body: JSON.stringify({ requestId: REAL_UUID }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(200);
    const keys = (redisDelMock.mock.calls[0] ?? []).map(String);
    const oldestAlive = NOW.getTime() - ASK_KV_TTL_S * MS_PER_SECOND;
    expect(keys).toContain(`ask:log:${dayOf(oldestAlive)}:${REAL_UUID}`);
  });
});
