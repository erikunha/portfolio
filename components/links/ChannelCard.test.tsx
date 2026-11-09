import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LINKS_LOCALE } from '@/content/links.constants';
import type { ChannelFeed } from '@/lib/links/feed';
import { ChannelCard } from './ChannelCard';

const CHANNEL_URL = 'https://www.youtube.com/@eriknagringa';

const emptyFeed: ChannelFeed = {
  fetchedAt: '2026-08-31T19:00:00Z',
  latest: null,
  history: [],
  stats: {},
  channelUrl: CHANNEL_URL,
};

const populatedFeed: ChannelFeed = {
  fetchedAt: '2026-08-31T19:00:00Z',
  latest: {
    id: 'abc',
    title: 'Montei um time de 12 agentes',
    url: 'https://www.youtube.com/watch?v=abc',
    thumbnailUrl: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
    publishedAt: '2026-08-28T19:00:00+00:00',
    description: 'O setup completo.',
    duration: '14:32',
  },
  history: [],
  stats: { subscriberCount: 12400, videoCount: 48 },
  channelUrl: CHANNEL_URL,
};

describe('ChannelCard', () => {
  it('renders the relative label from the feed timestamp in either locale', () => {
    const { container, rerender } = render(
      <ChannelCard locale={LINKS_LOCALE.en} feed={populatedFeed} />,
    );
    expect(container.textContent).toContain('3 days ago');
    rerender(<ChannelCard locale={LINKS_LOCALE.pt} feed={populatedFeed} />);
    expect(container.textContent).toContain('há 3 dias');
    rerender(
      <ChannelCard
        locale={LINKS_LOCALE.en}
        feed={{ ...populatedFeed, fetchedAt: '2026-09-01T19:00:00Z' }}
      />,
    );
    expect(container.textContent).toContain('4 days ago');
  });

  it('fetches the latest-video cover at high priority, because it is the largest paint on the page', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.en} feed={populatedFeed} />);
    const cover = container.querySelector('.links-thumb img');
    expect(cover?.getAttribute('fetchpriority'), 'the cover is the LCP element of /links').toBe(
      'high',
    );
    expect(cover?.getAttribute('loading'), 'a lazy LCP image waits for layout').toBeNull();
  });

  it('keeps the 16:9 block while the latest video is missing, so the card holds its shape', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={emptyFeed} />);
    expect(container.querySelector('.links-thumb-placeholder')).not.toBeNull();
    expect(container.textContent).toContain('O último vídeo não carregou');
    expect(container.textContent, 'the channel has published videos').not.toContain(
      'Sem vídeos por aqui ainda',
    );
  });

  it('offers subscribing even with nothing to watch yet, and does not offer watching', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={emptyFeed} />);
    expect(container.querySelector('[data-outbound="inscrever"]')).not.toBeNull();
    expect(container.querySelector('[data-outbound="assistir"]')).toBeNull();
    expect(container.querySelector('[data-outbound="ultimo-video"]')).toBeNull();
  });

  it('omits counts entirely when the Data API key is absent rather than showing zero', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={emptyFeed} />);
    expect(container.textContent).not.toMatch(/\d+\s*(vídeos|mil|K)/);
  });

  it('swaps the placeholder for the real video once the feed returns one', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={populatedFeed} />);
    expect(container.querySelector('.links-thumb-placeholder')).toBeNull();
    expect(container.textContent).toContain('Montei um time de 12 agentes');
    expect(container.querySelector('[data-outbound="ultimo-video"]')).not.toBeNull();
    expect(container.querySelector('[data-outbound="assistir"]')).not.toBeNull();
  });

  it('renders the counts the Data API supplied', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={populatedFeed} />);
    expect(container.textContent?.replace(/\s+/g, ' ')).toMatch(/12,4 mil . 48 vídeos/);
  });

  it('tags the subscribe link with sub_confirmation and the bio campaign', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={emptyFeed} />);
    const href = container.querySelector('[data-outbound="inscrever"]')?.getAttribute('href') ?? '';
    expect(href).toContain('sub_confirmation=1');
    expect(new URL(href).searchParams.get('utm_source')).toBe('bio');
  });

  it('hides the arrow glyph from screen readers so the watch button reads as its label', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.en} feed={populatedFeed} />);
    const watch = container.querySelector('[data-outbound="assistir"]');
    const arrow = watch?.querySelector('[aria-hidden="true"]');
    expect(arrow?.textContent).toBe('→');
    expect(watch?.textContent?.replace('→', '').replace(/\s+/g, ' ').trim()).toBe(
      'watch (opens in a new tab)',
    );
  });

  it('is a labelled section whose heading names the group in the page language', () => {
    const { container, rerender } = render(
      <ChannelCard locale={LINKS_LOCALE.pt} feed={populatedFeed} />,
    );
    const section = container.querySelector('section[data-col="channel"]');
    const heading = section?.querySelector('h2');
    expect(heading?.textContent).toBe('assistir');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    rerender(<ChannelCard locale={LINKS_LOCALE.en} feed={populatedFeed} />);
    expect(container.querySelector('h2')?.textContent).toBe('watch');
  });

  it('names the channel with its handle', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={populatedFeed} />);
    expect(container.querySelector('.links-watch-channel')?.textContent).toContain(
      'Erik Na Gringa',
    );
    expect(container.querySelector('.links-watch-channel')?.textContent).toContain('@eriknagringa');
  });

  it('makes the video title the link and keeps the cover out of the tab order', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={populatedFeed} />);
    const title = container.querySelector('a[data-outbound="ultimo-video-titulo"]');
    expect(title?.textContent).toContain('Montei um time de 12 agentes');
    expect(title?.closest('.links-watch-title')).not.toBeNull();

    const cover = container.querySelector('a[data-outbound="ultimo-video"]');
    expect(cover?.getAttribute('tabindex'), 'a second tab stop to the same destination').toBe('-1');
    expect(cover?.getAttribute('aria-hidden')).toBe('true');
    expect(cover?.querySelector('img')).not.toBeNull();
    const campaign = (link: Element | null | undefined) =>
      new URL(link?.getAttribute('href') ?? '').searchParams.get('utm_content');
    expect(campaign(cover)).toBe('ultimo-video');
    expect(campaign(title), 'each link to one video is attributable on its own').toBe(
      'ultimo-video-titulo',
    );
  });

  it('shows the new badge with the relative age and duration', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={populatedFeed} />);
    const meta = container.querySelector('.links-watch-meta');
    expect(meta?.textContent).toContain('novo');
    expect(meta?.textContent).toContain('há 3 dias');
    expect(meta?.textContent).toContain('14:32');
  });

  it('shows the description when the video has one', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={populatedFeed} />);
    const description = container.querySelector('.links-watch-desc');
    expect(description?.textContent).toBe('O setup completo.');
    expect(description?.hasAttribute('hidden')).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['missing', undefined],
  ])(
    'hides the description node, and renders no stray text, when it is %s',
    (_name, description) => {
      const feed: ChannelFeed = {
        ...populatedFeed,
        latest: populatedFeed.latest && { ...populatedFeed.latest, description },
      };
      const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={feed} />);
      const node = container.querySelector('.links-watch-desc');
      expect(node?.hasAttribute('hidden'), 'an empty block would still take a margin').toBe(true);
      expect(node?.textContent).toBe('');
    },
  );

  it('keeps the heading, the placeholder and the subscribe action when the feed is down', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.en} feed={emptyFeed} />);
    expect(container.querySelector('h2')?.textContent).toBe('watch');
    expect(container.querySelector('.links-thumb-placeholder')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(container.textContent).toContain('The latest video did not load just now');
    expect(container.querySelector('a[data-outbound="ultimo-video-titulo"]')).toBeNull();
    expect(container.querySelector('.links-watch-meta')).toBeNull();
    expect(container.querySelector('[data-outbound="inscrever"]')).not.toBeNull();
  });
});
