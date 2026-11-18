import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'test-cron-secret-0123456789';
const RUN_AT = '2026-11-18T05:00:00.000Z';
const DIGEST_DAY = '2026-11-17';
const OPEN_CURSOR = '7';
const DONE_CURSOR = '0';
const FP_A = 'a'.repeat(16);
const store = new Map<string, unknown>();
const scan = vi.fn();
const pipeSet = vi.fn();
const pipeExec = vi.fn(async () => []);
const warn = vi.fn();
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
vi.mock('@/lib/log', async () => ({
  log: { info: vi.fn(), error: vi.fn(), warn, debug: vi.fn() },
}));

const recordKey = `err:r1:${DIGEST_DAY}:${FP_A}`;

async function run(): Promise<Response> {
  const { GET } = await import('@/app/api/error-digest/route');
  return GET(
    new NextRequest('http://localhost/api/error-digest', {
      method: 'GET',
      headers: { authorization: `Bearer ${SECRET}` },
    }),
  );
}

async function summaryOf(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json()) as { data: Record<string, unknown> };
  return body.data;
}

const mailText = (): string => (send.mock.calls[0] as unknown as [{ text: string }])[0].text;

describe('GET /api/error-digest when the scan is cut short', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    store.clear();
    store.set(recordKey, { message: 'x is undefined', level: 'error' });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(RUN_AT));
    vi.stubEnv('CRON_SECRET', SECRET);
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    send.mockResolvedValue({ data: { id: 'mail-id' }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('reports truncated, warns, and writes no seen markers when the cursor never returns to 0', async () => {
    scan.mockResolvedValue([OPEN_CURSOR, [recordKey]]);
    const res = await run();
    expect(res.status).toBe(200);
    expect((await summaryOf(res)).truncated).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
    expect(pipeSet).not.toHaveBeenCalled();
    expect(pipeExec).not.toHaveBeenCalled();
  });

  it('still mails what it found and says the counts are partial', async () => {
    scan.mockResolvedValue([OPEN_CURSOR, [recordKey]]);
    await run();
    expect(send).toHaveBeenCalledOnce();
    expect(mailText()).toContain(FP_A);
    expect(mailText()).toMatch(/truncated|partial/i);
  });

  it('is not truncated when the last allowed page returns the done cursor', async () => {
    scan.mockResolvedValue([OPEN_CURSOR, [recordKey]]);
    await run();
    const cap = scan.mock.calls.length;
    vi.clearAllMocks();
    vi.resetModules();
    for (let page = 1; page < cap; page += 1) scan.mockResolvedValueOnce([OPEN_CURSOR, []]);
    scan.mockResolvedValueOnce([DONE_CURSOR, [recordKey]]);
    const res = await run();
    expect(scan).toHaveBeenCalledTimes(cap);
    expect((await summaryOf(res)).truncated).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    expect(pipeSet).toHaveBeenCalledWith(`errseen:${FP_A}`, DIGEST_DAY, expect.any(Object));
  });

  it('reports truncated false and keeps marking fingerprints on a complete scan', async () => {
    scan.mockResolvedValue([DONE_CURSOR, [recordKey]]);
    const res = await run();
    expect((await summaryOf(res)).truncated).toBe(false);
    expect(pipeSet).toHaveBeenCalledOnce();
  });
});
