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

describe('getChannelFeed excludes Shorts in the data layer', () => {
  const entry = (id: string, path: 'watch?v=' | 'shorts/', n: number) => `
    <entry>
      <yt:videoId>${id}</yt:videoId>
      <title>Title ${id}</title>
      <link rel="alternate" href="https://www.youtube.com/${path}${id}"/>
      <published>2026-10-0${n}T00:00:00+00:00</published>
    </entry>`;
  const rss = (entries: string[]) => `<feed xmlns:yt="y">${entries.join('')}</feed>`;

  async function loadWith(options: {
    rssBody: string;
    apiKey?: string;
    playlistIds?: string[];
    durations?: Record<string, string>;
  }) {
    vi.resetModules();
    vi.stubEnv('E2E_LINKS_FEED_FIXTURE', '');
    vi.doMock('@/lib/env', () => ({ env: { YOUTUBE_API_KEY: options.apiKey } }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (input.includes('/feeds/videos.xml')) {
          return options.rssBody
            ? new Response(options.rssBody)
            : new Response('', { status: 404 });
        }
        if (input.includes('/playlistItems')) {
          return Response.json({
            items: (options.playlistIds ?? []).map((id, index) => ({
              snippet: {
                title: `Upload ${id}`,
                publishedAt: `2026-10-0${index + 1}T00:00:00Z`,
                resourceId: { videoId: id },
              },
              status: { privacyStatus: 'public' },
            })),
          });
        }
        if (input.includes('/videos?')) {
          return Response.json({
            items: Object.entries(options.durations ?? {}).map(([id, duration]) => ({
              id,
              contentDetails: { duration },
            })),
          });
        }
        return Response.json({ items: [] });
      }),
    );
    const { getChannelFeed } = await import('@/lib/links/feed');
    const feed = await getChannelFeed();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    return feed;
  }

  it('drops a Short from the RSS feed and keeps the regular video', async () => {
    const feed = await loadWith({
      rssBody: rss([entry('short1', 'shorts/', 2), entry('video1', 'watch?v=', 1)]),
    });
    expect(feed.latest?.id).toBe('video1');
    expect(feed.history.map((video) => video.id)).toEqual(['video1']);
  });

  it('still fills the history with regular videos when Shorts lead the feed', async () => {
    const feed = await loadWith({
      rssBody: rss([
        entry('s1', 'shorts/', 9),
        entry('s2', 'shorts/', 8),
        ...[1, 2, 3, 4, 5, 6].map((n) => entry(`v${n}`, 'watch?v=', n)),
      ]),
    });
    expect(feed.history.map((video) => video.id)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
  });

  it('drops a 60 second upload read through the Data API fallback', async () => {
    const feed = await loadWith({
      rssBody: '',
      apiKey: 'test-key',
      playlistIds: ['clip', 'full'],
      durations: { clip: 'PT59S', full: 'PT12M3S' },
    });
    expect(feed.history.map((video) => video.id)).toEqual(['full']);
  });

  it('keeps a video just over a minute', async () => {
    const feed = await loadWith({
      rssBody: '',
      apiKey: 'test-key',
      playlistIds: ['edge'],
      durations: { edge: 'PT1M1S' },
    });
    expect(feed.history.map((video) => video.id)).toEqual(['edge']);
  });

  it('returns the empty feed when every upload is a Short', async () => {
    const feed = await loadWith({ rssBody: rss([entry('only', 'shorts/', 1)]) });
    expect(feed.latest).toBeNull();
    expect(feed.history).toEqual([]);
  });
});
