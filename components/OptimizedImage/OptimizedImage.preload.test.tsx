import { render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SITE_LOCALE } from '@/content/site-locale';
import type { ChannelFeed } from '@/lib/links/feed';

const preload = vi.hoisted(() => vi.fn());
const renderedImages = vi.hoisted(() => vi.fn());

vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  preload,
}));

vi.mock('@/components/OptimizedImage', async () => {
  const actual = await vi.importActual<typeof import('./OptimizedImage')>('./OptimizedImage');
  return {
    OptimizedImage: (props: ComponentProps<typeof actual.OptimizedImage>) => {
      renderedImages(props);
      return actual.OptimizedImage(props);
    },
  };
});

import { ChannelCard } from '@/components/links/ChannelCard/ChannelCard';
import { IdentityCard } from '@/components/links/IdentityCard/IdentityCard';
import { OptimizedImage } from './OptimizedImage';

const LOCAL_SRC = '/images/guitar-live.jpg';
const SIZES = '56px';
const SIZE_PX = 56;

const feed: ChannelFeed = {
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
  stats: {},
  channelUrl: 'https://www.youtube.com/@eriknagringa',
};

describe('OptimizedImage preload', () => {
  beforeEach(() => {
    preload.mockClear();
    renderedImages.mockClear();
  });

  it('preloads the exact source set it renders when given preload', () => {
    const { container } = render(
      <OptimizedImage
        src={LOCAL_SRC}
        alt=""
        width={SIZE_PX}
        height={SIZE_PX}
        sizes={SIZES}
        preload
      />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('loading'), 'a preloaded image is not lazy').toBeNull();
    expect(preload).toHaveBeenCalledTimes(1);
    const [href, options] = preload.mock.calls[0] ?? [];
    expect(href).toBe(img?.getAttribute('src'));
    expect(options).toMatchObject({
      as: 'image',
      imageSrcSet: img?.getAttribute('srcset'),
      imageSizes: SIZES,
    });
  });

  it('still preloads for the deprecated priority prop', () => {
    render(
      <OptimizedImage
        src={LOCAL_SRC}
        alt=""
        width={SIZE_PX}
        height={SIZE_PX}
        sizes={SIZES}
        priority
      />,
    );
    expect(preload).toHaveBeenCalledTimes(1);
  });

  it('lets an explicit preload={false} win over priority', () => {
    render(
      <OptimizedImage
        src={LOCAL_SRC}
        alt=""
        width={SIZE_PX}
        height={SIZE_PX}
        sizes={SIZES}
        preload={false}
        priority
      />,
    );
    expect(preload).not.toHaveBeenCalled();
  });

  it('does not preload without either prop', () => {
    render(<OptimizedImage src={LOCAL_SRC} alt="" width={SIZE_PX} height={SIZE_PX} />);
    expect(preload).not.toHaveBeenCalled();
  });
});

describe('links cards request the preload with the current prop', () => {
  beforeEach(() => {
    preload.mockClear();
    renderedImages.mockClear();
  });

  it('the identity avatar passes preload and no deprecated priority', () => {
    render(<IdentityCard locale={SITE_LOCALE.en} />);
    expect(renderedImages).toHaveBeenCalledTimes(1);
    const props = renderedImages.mock.calls[0]?.[0];
    expect(props.preload).toBe(true);
    expect(props).not.toHaveProperty('priority');
    expect(preload).toHaveBeenCalledTimes(1);
  });

  it('the latest-video cover passes preload and no deprecated priority', () => {
    render(<ChannelCard locale={SITE_LOCALE.en} feed={feed} />);
    const cover = renderedImages.mock.calls
      .map(([props]) => props)
      .find((props) => props.src === feed.latest?.thumbnailUrl);
    expect(cover?.preload).toBe(true);
    expect(cover).not.toHaveProperty('priority');
    expect(preload).toHaveBeenCalledTimes(1);
  });
});
