import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ cacheLife: vi.fn() }));

const DEADLINE_MS = 12_000;

async function loadFeed(apiKey: string | undefined) {
  vi.resetModules();
  vi.stubEnv('E2E_LINKS_FEED_FIXTURE', '');
  vi.doMock('@/lib/env', () => ({ env: { YOUTUBE_API_KEY: apiKey } }));
  return import('@/lib/links/feed');
}

function hangingFetch() {
  const started: Array<{ url: string; signal: AbortSignal }> = [];
  const fetchMock = vi.fn(
    (input: string, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_, reject) => {
        const signal = init?.signal as AbortSignal;
        started.push({ url: input, signal });
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        signal.addEventListener('abort', () => reject(signal.reason));
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return started;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.doUnmock('@/lib/env');
});

describe('getChannelFeed failure caching', () => {
  const SHORT_REVALIDATE_S = 120;

  it('shortens the cache life of an empty result so a transient outage does not stick for an hour', async () => {
    hangingFetch();
    const { getChannelFeed } = await loadFeed('key');
    const { cacheLife } = await import('next/cache');
    vi.mocked(cacheLife).mockClear();
    vi.useFakeTimers();
    const pending = getChannelFeed();
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);
    const feed = await pending;

    expect(feed.latest).toBeNull();
    const profiles = vi.mocked(cacheLife).mock.calls.map(([profile]) => profile) as Array<{
      revalidate?: number;
    }>;
    expect(
      profiles.some(
        (profile) => (profile.revalidate ?? Number.POSITIVE_INFINITY) <= SHORT_REVALIDATE_S,
      ),
      'an empty feed must be retried within minutes, not after the one-hour revalidate',
    ).toBe(true);
  });
});

describe('getChannelFeed cold path', () => {
  it('asks for the channel stats and the uploads at the same time', async () => {
    const started = hangingFetch();
    const { getChannelFeed } = await loadFeed('key');
    vi.useFakeTimers();
    const pending = getChannelFeed();
    await vi.advanceTimersByTimeAsync(0);

    const urls = started.map((call) => call.url);
    expect(urls.some((url) => url.includes('/channels'))).toBe(true);
    expect(urls.some((url) => url.includes('/playlistItems'))).toBe(true);

    await vi.advanceTimersByTimeAsync(DEADLINE_MS);
    await pending;
  });

  it('gives every upstream call one shared deadline and resolves empty when it passes', async () => {
    const started = hangingFetch();
    const { getChannelFeed, EMPTY_FEED } = await loadFeed('key');
    vi.useFakeTimers();
    const pending = getChannelFeed();
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);
    const feed = await pending;

    expect(feed.latest).toBeNull();
    expect(feed.history).toEqual(EMPTY_FEED.history);
    expect(started.length).toBeGreaterThan(0);
    for (const call of started) expect(call.signal.aborted).toBe(true);
  });
});
