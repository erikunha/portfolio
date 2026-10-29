import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ cacheLife: vi.fn() }));

const FIXTURE = join(process.cwd(), 'tests/e2e/fixtures/links-feed.json');

describe('loadFixtureFeed', () => {
  it('returns null when the flag is unset', async () => {
    const { loadFixtureFeed } = await import('@/lib/links/feed');
    expect(await loadFixtureFeed({})).toBeNull();
  });

  it('loads the fixture when the flag points at it', async () => {
    const { loadFixtureFeed, FEED_FIXTURE_ENV } = await import('@/lib/links/feed');
    const feed = await loadFixtureFeed({ [FEED_FIXTURE_ENV]: FIXTURE });
    expect(feed?.latest?.id).toBeTruthy();
  });

  it('is inert on a Vercel deployment even when the flag is set', async () => {
    const { loadFixtureFeed, FEED_FIXTURE_ENV } = await import('@/lib/links/feed');
    expect(await loadFixtureFeed({ [FEED_FIXTURE_ENV]: FIXTURE, VERCEL: '1' })).toBeNull();
  });
});
