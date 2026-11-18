import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'cron-secret-for-tests';
const RUN_AT = '2026-11-18T05:00:00.000Z';
const DIGEST_DAY = '2026-11-17';
const SEEN_TTL_SECONDS = 2_592_000;
const OVER_THRESHOLD = 20;
const FP_A = 'a'.repeat(16);
const FP_B = 'b'.repeat(16);
const store = new Map<string, unknown>();
const scan = vi.fn();
const pipeSet = vi.fn();
const pipeExec = vi.fn(async () => []);
const send = vi.fn(
  async (): Promise<{ data: { id: string } | null; error: { message: string } | null }> => ({
    data: { id: 'mail-id' },
    error: null,
  }),
);

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    scan,
    mget: async (...keys: string[]) => keys.map((key) => store.get(key) ?? null),
    pipeline: () => ({ set: pipeSet.mockReturnThis(), exec: pipeExec }),
  }),
}));
vi.mock('resend', async () => (await import('@/__tests__/helpers/modules')).resendModule(send));
vi.mock('@/lib/log', async () => (await import('@/__tests__/helpers/modules')).logModule());

const errKey = (release: string, fingerprint: string) =>
  `err:${release}:${DIGEST_DAY}:${fingerprint}`;
const countKey = (release: string, fingerprint: string) =>
  `errn:${release}:${DIGEST_DAY}:${fingerprint}`;

function seed(release: string, fingerprint: string, message: string, repeats = 0): string {
  store.set(errKey(release, fingerprint), { message, level: 'error' });
  if (repeats > 0) store.set(countKey(release, fingerprint), repeats);
  return errKey(release, fingerprint);
}

function request(authorization: string | null): NextRequest {
  return new NextRequest('http://localhost/api/error-digest', {
    method: 'GET',
    headers: authorization ? { authorization } : {},
  });
}

async function run(authorization: string | null = `Bearer ${SECRET}`): Promise<Response> {
  const { GET } = await import('@/app/api/error-digest/route');
  return GET(request(authorization));
}

const mailText = (): string => (send.mock.calls[0] as unknown as [{ text: string }])[0].text;
const markedSeen = (): string[] => pipeSet.mock.calls.map(([key]) => String(key));

describe('GET /api/error-digest', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    store.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(RUN_AT));
    vi.stubEnv('CRON_SECRET', SECRET);
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    scan.mockResolvedValue(['0', []]);
    send.mockResolvedValue({ data: { id: 'mail-id' }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each([
    ['no authorization header', null],
    ['a wrong secret', 'Bearer not-the-secret-at-all-0000'],
  ])('answers 401 with %s and touches nothing', async (_name, authorization) => {
    const res = await run(authorization);
    expect(res.status).toBe(401);
    expect(scan).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('scans only the previous UTC day', async () => {
    await run();
    expect(scan).toHaveBeenCalledWith(
      '0',
      expect.objectContaining({ match: `err:*:${DIGEST_DAY}:*` }),
    );
  });

  it('follows the scan cursor until it returns to 0', async () => {
    const first = seed('r1', FP_A, 'first');
    const second = seed('r1', FP_B, 'second');
    scan.mockResolvedValueOnce(['7', [first]]).mockResolvedValueOnce(['0', [second]]);
    await run();
    expect(scan).toHaveBeenCalledTimes(2);
    expect(scan.mock.calls[1]?.[0]).toBe('7');
    expect(mailText()).toContain(FP_A);
    expect(mailText()).toContain(FP_B);
  });

  it('mails a fingerprint it has not seen before, with its count and message', async () => {
    scan.mockResolvedValueOnce(['0', [seed('r1', FP_A, 'x is undefined', 4)]]);
    const res = await run();
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
    expect(mailText()).toContain(FP_A);
    expect(mailText()).toContain('x is undefined');
    expect(mailText()).toMatch(/\b5x/);
  });

  it('sums the record and its counter, and joins releases, per fingerprint', async () => {
    scan.mockResolvedValueOnce([
      '0',
      [seed('r1', FP_A, 'same error', 2), seed('r2', FP_A, 'same error', 6)],
    ]);
    await run();
    expect(mailText().match(new RegExp(FP_A, 'g'))).toHaveLength(1);
    expect(mailText()).toMatch(/\b10x/);
    expect(mailText()).toContain('r1');
    expect(mailText()).toContain('r2');
  });

  it('does not mail a known fingerprint under the threshold, and still refreshes its marker', async () => {
    scan.mockResolvedValueOnce(['0', [seed('r1', FP_A, 'known', OVER_THRESHOLD - 2)]]);
    store.set(`errseen:${FP_A}`, DIGEST_DAY);
    const res = await run();
    expect(res.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
    expect(markedSeen()).toEqual([`errseen:${FP_A}`]);
  });

  it('mails a known fingerprint once its count reaches the threshold', async () => {
    scan.mockResolvedValueOnce(['0', [seed('r1', FP_A, 'noisy', OVER_THRESHOLD - 1)]]);
    store.set(`errseen:${FP_A}`, DIGEST_DAY);
    await run();
    expect(send).toHaveBeenCalledOnce();
    expect(mailText()).toContain(FP_A);
  });

  it('lists only the new and over-threshold fingerprints in a mixed day', async () => {
    scan.mockResolvedValueOnce([
      '0',
      [seed('r1', FP_A, 'quiet known', 1), seed('r1', FP_B, 'brand new', 0)],
    ]);
    store.set(`errseen:${FP_A}`, DIGEST_DAY);
    await run();
    expect(mailText()).toContain(FP_B);
    expect(mailText()).not.toContain(FP_A);
  });

  it('marks every fingerprint seen for 30 days after a successful mail', async () => {
    scan.mockResolvedValueOnce(['0', [seed('r1', FP_A, 'm')]]);
    await run();
    expect(pipeSet).toHaveBeenCalledWith(`errseen:${FP_A}`, DIGEST_DAY, { ex: SEEN_TTL_SECONDS });
    expect(pipeExec).toHaveBeenCalledOnce();
  });

  it('keeps the fingerprint new for tomorrow when the mail fails', async () => {
    scan.mockResolvedValueOnce(['0', [seed('r1', FP_A, 'm')]]);
    send.mockResolvedValueOnce({ data: null, error: { message: 'resend down' } });
    const res = await run();
    expect(res.status).toBe(502);
    expect(pipeSet).not.toHaveBeenCalled();
  });

  it('sends nothing on a day without error records', async () => {
    const res = await run();
    expect(res.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 503 when the store cannot be scanned', async () => {
    scan.mockRejectedValueOnce(new Error('kv down'));
    const res = await run();
    expect(res.status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });

  it('is registered as one daily cron in vercel.json, after the UTC day it digests has ended', () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons: { path: string; schedule: string }[];
    };
    const entries = config.crons.filter((cron) => cron.path === '/api/error-digest');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });
});
