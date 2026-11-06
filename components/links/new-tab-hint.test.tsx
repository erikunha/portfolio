import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { linksContent } from '@/content/links';
import { LINKS_LOCALE } from '@/content/links.constants';
import type { ChannelFeed } from '@/lib/links/feed';
import { ChannelCard } from './ChannelCard';
import { PlaylistCards } from './PlaylistCards';
import { VideoHistory } from './VideoHistory';

const CHANNEL_URL = 'https://www.youtube.com/@eriknagringa';
const video = (id: string) => ({
  id,
  title: `Video ${id}`,
  url: `https://www.youtube.com/watch?v=${id}`,
  thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  publishedAt: '2026-08-28T19:00:00+00:00',
  description: 'desc',
  duration: '14:32',
});
const feed: ChannelFeed = {
  fetchedAt: '2026-08-31T19:00:00Z',
  latest: video('a'),
  history: [video('b'), video('c')],
  stats: { subscriberCount: 12400, videoCount: 48 },
  channelUrl: CHANNEL_URL,
};

describe.each(Object.values(LINKS_LOCALE))('/links new-tab anchors (%s)', (locale) => {
  const hint = `(${linksContent.copy.opensInNewTab[locale]})`;

  it.each([
    ['ChannelCard', () => <ChannelCard locale={locale} feed={feed} />],
    ['VideoHistory', () => <VideoHistory locale={locale} feed={feed} />],
    ['PlaylistCards', () => <PlaylistCards locale={locale} channelUrl={CHANNEL_URL} />],
  ])('%s tells a screen reader every new-tab link opens a new tab', (_name, ui) => {
    const { container } = render(ui());
    const anchors = [...container.querySelectorAll('a[target="_blank"]')];
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(anchor.textContent, anchor.getAttribute('href') ?? '').toContain(hint);
    }
  });
});
