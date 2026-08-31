import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LINKS_LOCALE } from '@/content/links.constants';
import type { ChannelFeed } from '@/lib/links/feed';
import { ChannelCard } from './ChannelCard';

vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: this IS the jsdom stand-in for next/image, so there is no image pipeline to prefer and no LCP to guard.
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const CHANNEL_URL = 'https://www.youtube.com/@eriknagringa';

const emptyFeed: ChannelFeed = {
  latest: null,
  history: [],
  stats: {},
  channelUrl: CHANNEL_URL,
};

const populatedFeed: ChannelFeed = {
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
  it('keeps the 16:9 block before the first video exists, so the card holds its shape', () => {
    const { container } = render(<ChannelCard locale={LINKS_LOCALE.pt} feed={emptyFeed} />);
    expect(container.querySelector('.links-thumb-placeholder')).not.toBeNull();
    expect(container.textContent).toContain('Sem vídeos por aqui ainda');
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
});
