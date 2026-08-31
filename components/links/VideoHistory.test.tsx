import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LINKS_LOCALE } from '@/content/links.constants';
import type { ChannelFeed } from '@/lib/links/feed';
import { VideoHistory } from './VideoHistory';

vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: this IS the jsdom stand-in for next/image, so there is no image pipeline to prefer and no LCP to guard.
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const CHANNEL_URL = 'https://www.youtube.com/@eriknagringa';

function feedWith(count: number): ChannelFeed {
  return {
    latest: null,
    history: Array.from({ length: count }, (_, i) => ({
      id: `id-${i}`,
      title: `Vídeo ${i + 1}`,
      url: `https://www.youtube.com/watch?v=id-${i}`,
      thumbnailUrl: `https://i.ytimg.com/vi/id-${i}/hqdefault.jpg`,
      publishedAt: '2026-08-28T19:00:00+00:00',
      ...(i === 0 ? { duration: '14:32', viewCount: 9100 } : {}),
    })),
    stats: {},
    channelUrl: CHANNEL_URL,
  };
}

const empty = feedWith(0);

describe('VideoHistory', () => {
  it('keeps its section and heading when the channel has no videos yet', () => {
    const { container } = render(<VideoHistory locale={LINKS_LOCALE.pt} feed={empty} />);
    expect(container.querySelector('[data-col="history"]')).not.toBeNull();
    expect(container.querySelector('h2')?.textContent).toContain('últimos vídeos');
  });

  it('states there are no entries rather than showing placeholder rows', () => {
    const { container } = render(<VideoHistory locale={LINKS_LOCALE.pt} feed={empty} />);
    expect(container.querySelectorAll('li')).toHaveLength(0);
    expect(container.textContent).toContain('nenhuma entrada ainda');
  });

  it('hides the see-all link while there is nothing to see all of', () => {
    const { container } = render(<VideoHistory locale={LINKS_LOCALE.pt} feed={empty} />);
    expect(container.querySelector('a[data-outbound="todos-videos"]')).toBeNull();
  });

  it('renders one row per video once the feed returns some', () => {
    const { container } = render(<VideoHistory locale={LINKS_LOCALE.pt} feed={feedWith(5)} />);
    expect(container.querySelectorAll('li')).toHaveLength(5);
    expect(container.textContent).not.toContain('nenhuma entrada ainda');
  });

  it('numbers the rows and tags each link for attribution', () => {
    const { container } = render(<VideoHistory locale={LINKS_LOCALE.pt} feed={feedWith(3)} />);
    const links = [...container.querySelectorAll('li a')];
    expect(links.map((a) => a.getAttribute('data-outbound'))).toEqual([
      'video-1',
      'video-2',
      'video-3',
    ]);
    expect(container.textContent).toContain('01');
    expect(container.textContent).toContain('03');
  });

  it('shows duration and views only for the entries that carry them', () => {
    const { container } = render(<VideoHistory locale={LINKS_LOCALE.pt} feed={feedWith(2)} />);
    const rows = [...container.querySelectorAll('li')];
    // Intl compact notation separates "9,1" and "mil" with a non-breaking space, so the
    // whitespace here is matched loosely rather than typed literally.
    expect(rows[0]?.textContent?.replace(/\s+/g, ' ')).toMatch(/14:32 . 9,1 mil visualizações/);
    expect(
      rows[1]?.textContent,
      'the second entry carries neither duration nor viewCount, so its meta line must not invent them',
    ).not.toMatch(/14:32|visualizações/);
  });

  it('restores the see-all link once videos exist', () => {
    const { container } = render(<VideoHistory locale={LINKS_LOCALE.pt} feed={feedWith(5)} />);
    const seeAll = container.querySelector('a[data-outbound="todos-videos"]');
    expect(seeAll?.getAttribute('href')).toContain(`${CHANNEL_URL}/videos`);
  });

  it('localises the view count word on the English route', () => {
    const { container } = render(<VideoHistory locale={LINKS_LOCALE.en} feed={feedWith(1)} />);
    expect(container.textContent).toContain('9.1K views');
  });
});
