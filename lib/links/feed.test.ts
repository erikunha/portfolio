import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ cacheLife: vi.fn() }));
vi.mock('node:fs/promises', { spy: true });

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

  it('provides a full history with remote thumbnails for the e2e image checks', async () => {
    const { loadFixtureFeed, FEED_FIXTURE_ENV, HISTORY_LENGTH } = await import('@/lib/links/feed');
    const feed = await loadFixtureFeed({ [FEED_FIXTURE_ENV]: FIXTURE });

    if (!feed?.latest) throw new Error('Fixture must provide a latest video');
    expect(feed.history).toHaveLength(HISTORY_LENGTH);
    for (const video of [feed.latest, ...feed.history]) {
      expect(video.thumbnailUrl).toBe(`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`);
    }
  });

  it('preserves fixture data while normalizing thumbnail hosts', async () => {
    const { loadFixtureFeed, FEED_FIXTURE_ENV } = await import('@/lib/links/feed');
    const fixture = JSON.parse(await fs.readFile(FIXTURE, 'utf8'));
    fixture.latest.duration = '14:32';
    fixture.latest.viewCount = 1234;
    fixture.latest.thumbnailUrl = 'https://i3.ytimg.com/vi/latest/hqdefault.jpg?sqp=abc&rs=def';
    fixture.history[0].thumbnailUrl = 'https://img.example.com/archive.jpg';
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(fixture));

    expect(await loadFixtureFeed({ [FEED_FIXTURE_ENV]: FIXTURE })).toEqual({
      ...fixture,
      latest: {
        ...fixture.latest,
        thumbnailUrl: 'https://i.ytimg.com/vi/latest/hqdefault.jpg?sqp=abc&rs=def',
      },
    });
  });

  it('preserves a missing latest video and empty history', async () => {
    const { loadFixtureFeed, FEED_FIXTURE_ENV, EMPTY_FEED } = await import('@/lib/links/feed');
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(EMPTY_FEED));

    expect(await loadFixtureFeed({ [FEED_FIXTURE_ENV]: FIXTURE })).toEqual(EMPTY_FEED);
  });

  it('is inert on a Vercel deployment even when the flag is set', async () => {
    const { loadFixtureFeed, FEED_FIXTURE_ENV } = await import('@/lib/links/feed');
    expect(await loadFixtureFeed({ [FEED_FIXTURE_ENV]: FIXTURE, VERCEL: '1' })).toBeNull();
  });
});

describe('getChannelFeed upstream fallback', () => {
  const PLAYLIST = {
    items: [1, 2, 3].map((n) => ({
      snippet: {
        title: `Upload ${n}`,
        publishedAt: `2026-10-0${n}T00:00:00Z`,
        resourceId: { videoId: `v${n}` },
      },
      status: { privacyStatus: 'public' },
    })),
  };

  async function load(apiKey: string | undefined) {
    vi.resetModules();
    vi.stubEnv('E2E_LINKS_FEED_FIXTURE', '');
    vi.doMock('@/lib/env', () => ({ env: { YOUTUBE_API_KEY: apiKey } }));
    const requested: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        requested.push(input);
        if (input.includes('/feeds/videos.xml')) return new Response('', { status: 404 });
        if (input.includes('/playlistItems')) return Response.json(PLAYLIST);
        return Response.json({ items: [] });
      }),
    );
    const { getChannelFeed } = await import('@/lib/links/feed');
    return { feed: await getChannelFeed(), requested };
  }

  it('reads the uploads playlist through the Data API when the RSS feed fails', async () => {
    const { feed, requested } = await load('test-key');
    expect(feed.latest?.id).toBe('v1');
    expect(feed.history.map((v) => v.id)).toEqual(['v1', 'v2', 'v3']);
    const playlistCall = requested.find((url) => url.includes('/playlistItems'));
    expect(playlistCall).toContain('playlistId=UUZ1P4Pqpo-j_uAHaIc_pGrA');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns the empty feed without a key when the RSS feed fails', async () => {
    const { feed, requested } = await load(undefined);
    expect(feed.latest).toBeNull();
    expect(requested.some((url) => url.includes('googleapis'))).toBe(false);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
