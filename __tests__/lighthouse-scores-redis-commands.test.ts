import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CACHE_KEY = 'lh:scores:desktop';
const LAST_GOOD_KEY = 'lh:scores:last-good:desktop';
const NEGATIVE_CACHE_WINDOW_MS = 60_000;
const SLOW_CACHE_READ_MS = 1_000;
const SSR_REDIS_TIMEOUT_MS = 3_000;

const TODAY = {
  performance: 99,
  accessibility: 100,
  bestPractices: 95,
  seo: 100,
  fetchedAt: '2026-11-08T03:00:00.000Z',
};
const LAST_GOOD = { ...TODAY, performance: 91, fetchedAt: '2026-11-07T03:00:00.000Z' };

type Command = { op: 'get' | 'set'; key: string };

const store = new Map<string, unknown>();
const hanging = new Set<string>();
const commands: Command[] = [];
const afterTasks: Array<() => Promise<void> | void> = [];

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => Promise<void> | void) => {
    afterTasks.push(task);
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  getRedis: () => ({
    get: vi.fn(async (key: string) => {
      commands.push({ op: 'get', key });
      if (hanging.has(key)) return new Promise(() => undefined);
      return store.get(key) ?? null;
    }),
    set: vi.fn(async (key: string, value: unknown) => {
      commands.push({ op: 'set', key });
      store.set(key, value);
      return 'OK';
    }),
  }),
}));

vi.mock('@/lib/log', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const psiOk = () => ({
  ok: true,
  json: async () => ({
    lighthouseResult: {
      categories: {
        performance: { score: 0.97 },
        accessibility: { score: 1 },
        'best-practices': { score: 0.95 },
        seo: { score: 1 },
      },
    },
  }),
});

async function runAfterTasks(): Promise<void> {
  while (afterTasks.length > 0) await afterTasks.shift()?.();
}

const count = (op: Command['op'], key?: string) =>
  commands.filter((c) => c.op === op && (key === undefined || c.key === key)).length;

beforeEach(() => {
  vi.resetModules();
  store.clear();
  hanging.clear();
  commands.length = 0;
  afterTasks.length = 0;
  mockFetch.mockReset();
  process.env.PSI_API_KEY = 'test-key';
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.PSI_API_KEY;
});

describe('getScores Redis traffic', () => {
  it('spends one command per strategy on a cache hit and never reads the last-good copy', async () => {
    store.set(CACHE_KEY, TODAY);
    store.set(LAST_GOOD_KEY, LAST_GOOD);
    const { getScores } = await import('@/lib/lighthouse-scores');
    await expect(getScores('desktop')).resolves.toEqual(TODAY);
    expect(commands).toEqual([{ op: 'get', key: CACHE_KEY }]);
  });

  it('reads the last-good copy only when the fetch fails after a miss', async () => {
    store.set(LAST_GOOD_KEY, LAST_GOOD);
    mockFetch.mockRejectedValue(new Error('psi down'));
    const { getScores } = await import('@/lib/lighthouse-scores');
    await expect(getScores('desktop')).resolves.toEqual({ ...LAST_GOOD, stale: true });
    expect(count('get', CACHE_KEY)).toBe(1);
    expect(count('get', LAST_GOOD_KEY)).toBe(1);
  });

  it('defers the cache and last-good writes until after the response', async () => {
    mockFetch.mockResolvedValue(psiOk());
    const { getScores } = await import('@/lib/lighthouse-scores');
    await getScores('desktop');
    expect(count('set')).toBe(0);
    await runAfterTasks();
    expect(count('set', CACHE_KEY)).toBe(1);
    expect(count('set', LAST_GOOD_KEY)).toBe(1);
  });

  it('serves the failure from memory for the negative window with no Redis or PSI traffic', async () => {
    vi.useFakeTimers();
    mockFetch.mockRejectedValue(new Error('psi down'));
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    await expect(getScores('desktop')).resolves.toEqual(LIGHTHOUSE_FALLBACK);
    const afterFirst = { commands: commands.length, fetches: mockFetch.mock.calls.length };

    await vi.advanceTimersByTimeAsync(NEGATIVE_CACHE_WINDOW_MS - 1);
    await expect(getScores('desktop')).resolves.toEqual(LIGHTHOUSE_FALLBACK);
    expect(commands).toHaveLength(afterFirst.commands);
    expect(mockFetch).toHaveBeenCalledTimes(afterFirst.fetches);

    await vi.advanceTimersByTimeAsync(2);
    await getScores('desktop');
    expect(mockFetch.mock.calls.length).toBeGreaterThan(afterFirst.fetches);
  });

  it('does not negative-cache a success', async () => {
    store.set(CACHE_KEY, TODAY);
    const { getScores } = await import('@/lib/lighthouse-scores');
    await getScores('desktop');
    await getScores('desktop');
    expect(count('get', CACHE_KEY)).toBe(2);
  });

  it('keeps strategies independent in the negative cache', async () => {
    mockFetch.mockRejectedValue(new Error('psi down'));
    const { getScores } = await import('@/lib/lighthouse-scores');
    await getScores('desktop');
    store.set('lh:scores:mobile', { ...TODAY, performance: 80 });
    await expect(getScores('mobile')).resolves.toMatchObject({ performance: 80 });
  });

  it('starts the last-good read only once the cache read is slow, then serves it after the timeout', async () => {
    vi.useFakeTimers();
    store.set(LAST_GOOD_KEY, LAST_GOOD);
    hanging.add(CACHE_KEY);
    const { getScores } = await import('@/lib/lighthouse-scores');
    const settled = vi.fn();
    const pending = getScores('desktop').then(settled);
    await vi.advanceTimersByTimeAsync(0);
    expect(count('get', LAST_GOOD_KEY)).toBe(0);
    await vi.advanceTimersByTimeAsync(SLOW_CACHE_READ_MS);
    expect(count('get', LAST_GOOD_KEY)).toBe(1);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SSR_REDIS_TIMEOUT_MS);
    await pending;
    expect(settled).toHaveBeenCalledWith({ ...LAST_GOOD, stale: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
