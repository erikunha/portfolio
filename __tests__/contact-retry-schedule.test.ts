import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_CRON_SECRET = 'x'.repeat(24);
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const DAY_MS = MINUTES_PER_DAY * MS_PER_MINUTE;
const RESEND_IDEMPOTENCY_WINDOW_MS = DAY_MS;
const RETRY_PATH = '/api/contact-retry';
const DAILY_SCHEDULE = /^(\d{1,2}) (\d{1,2}) \* \* \*$/;
const SCAN_DAYS = 3;
const LAST_MINUTE_OF_HOUR = MINUTES_PER_HOUR - 1;
const RUN_AT = '2026-11-13T04:00:00.000Z';

const transaction = { zrem: vi.fn(), hdel: vi.fn(), exec: vi.fn() };
const redis = {
  zrange: vi.fn(),
  get: vi.fn(),
  hget: vi.fn(),
  hincrby: vi.fn(),
  multi: () => transaction,
};
const send = vi.fn();
vi.mock('@/lib/rate-limit', () => ({ getRedis: () => redis }));
vi.mock('@/lib/log', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

const retrySchedules = (): string[] => {
  const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
    crons: { path: string; schedule: string }[];
  };
  return config.crons.filter((cron) => cron.path === RETRY_PATH).map((cron) => cron.schedule);
};

const scheduledHours = (): number[] =>
  retrySchedules().map((schedule) => {
    const match = DAILY_SCHEDULE.exec(schedule);
    if (!match) throw new Error(`not a once-a-day schedule: ${schedule}`);
    return Number(match[2]);
  });

function runOffsetsMinutes(minuteOfEachRun: number[]): number[] {
  const hours = scheduledHours();
  const offsets: number[] = [];
  for (let day = 0; day < SCAN_DAYS; day++) {
    hours.forEach((hour, slot) => {
      const minuteInHour = minuteOfEachRun[day * hours.length + slot] ?? 0;
      offsets.push(day * MINUTES_PER_DAY + hour * MINUTES_PER_HOUR + minuteInHour);
    });
  }
  return offsets.sort((a, b) => a - b);
}

function minuteChoices(): number[][] {
  const runs = scheduledHours().length * SCAN_DAYS;
  const choices: number[][] = [];
  for (let mask = 0; mask < 2 ** runs; mask++) {
    choices.push(
      Array.from({ length: runs }, (_, run) => ((mask >> run) & 1 ? LAST_MINUTE_OF_HOUR : 0)),
    );
  }
  return choices;
}

describe('the contact retry schedule reaches every queued message inside the idempotency window', () => {
  it('runs each cron entry once a day, the only frequency the Hobby plan accepts', () => {
    expect(retrySchedules().length).toBeGreaterThan(0);
    for (const schedule of retrySchedules()) {
      expect(schedule, 'Hobby rejects a cron expression that fires more than once a day').toMatch(
        DAILY_SCHEDULE,
      );
    }
  });

  it('retries a message queued at any minute before it is 24 hours old, wherever each run lands in its hour', async () => {
    const { isContactRetryExpired } = await import('@/lib/contact-outbox');
    const missed: string[] = [];
    for (const minuteInHour of minuteChoices()) {
      const runs = runOffsetsMinutes(minuteInHour);
      for (let queuedAt = 0; queuedAt < MINUTES_PER_DAY; queuedAt++) {
        const firstRun = runs.find((run) => run >= queuedAt);
        if (firstRun === undefined) {
          missed.push(`no run after minute ${queuedAt} with run minutes ${minuteInHour.join('/')}`);
          continue;
        }
        const ageMs = (firstRun - queuedAt) * MS_PER_MINUTE;
        if (isContactRetryExpired(0, ageMs)) {
          missed.push(
            `queued at minute ${queuedAt} with run minutes ${minuteInHour.join('/')}: first retry at age ${ageMs / MS_PER_MINUTE} minutes`,
          );
        }
      }
    }
    expect(missed).toEqual([]);
  });
});

describe('a message is never retried at or after the idempotency window', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(RUN_AT));
    vi.stubEnv('CRON_SECRET', TEST_CRON_SECRET);
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    redis.zrange.mockResolvedValue(['message-id']);
    redis.hget.mockResolvedValue(0);
    redis.hincrby.mockResolvedValue(1);
    transaction.exec.mockResolvedValue([1, 1]);
    send.mockResolvedValue({ data: { id: 'accepted' }, error: null });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each([
    ['exactly 24 hours', RESEND_IDEMPOTENCY_WINDOW_MS],
    ['one millisecond past 24 hours', RESEND_IDEMPOTENCY_WINDOW_MS + 1],
    ['a week', 7 * DAY_MS],
  ])('drops a message received %s ago without sending', async (_label, ageMs) => {
    redis.get.mockResolvedValue({
      name: 'Visitor',
      email: 'visitor@example.com',
      message: 'Private message',
      ipHash: 'hash',
      receivedAt: new Date(Date.parse(RUN_AT) - ageMs).toISOString(),
    });
    const { GET } = await import('@/app/api/contact-retry/route');

    const res = await GET(
      new NextRequest(`http://localhost${RETRY_PATH}`, {
        headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
      }),
    );

    expect(send, 'a retry at or past the key lifetime can email twice').not.toHaveBeenCalled();
    expect((await res.json()).data).toMatchObject({ sent: 0, expired: 1 });
  });
});
