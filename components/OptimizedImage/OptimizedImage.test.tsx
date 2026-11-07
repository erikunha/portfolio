import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const preload = vi.hoisted(() => vi.fn());

vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  preload,
}));

import { OptimizedImage } from './OptimizedImage';

const LOCAL_SRC = '/images/guitar-live.jpg';
const REMOTE_SRC = 'https://i.ytimg.com/vi/abc/hqdefault.jpg';

describe('OptimizedImage', () => {
  beforeEach(() => {
    preload.mockClear();
  });

  it('serves a sized image through the optimizer with a width ladder and lazy loading', () => {
    const { container } = render(
      <OptimizedImage src={LOCAL_SRC} alt="stage" width={450} height={450} sizes="320px" />,
    );
    const img = container.querySelector('img');
    expect(
      img?.getAttribute('srcset'),
      'the optimizer ladder is what keeps the photo small',
    ).toMatch(/_next\/image\?url=%2Fimages%2Fguitar-live\.jpg&w=\d+&q=75 \d+w/);
    expect(img?.getAttribute('src')).toContain('_next/image?url=%2Fimages%2Fguitar-live.jpg');
    expect(img?.getAttribute('alt')).toBe('stage');
    expect(img?.getAttribute('width')).toBe('450');
    expect(img?.getAttribute('height')).toBe('450');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('decoding')).toBe('async');
    expect(img?.getAttribute('sizes')).toBe('320px');
  });

  it('keeps the class name and fills the positioned parent in fill mode', () => {
    const { container } = render(
      <OptimizedImage src={REMOTE_SRC} alt="" fill sizes="64px" className="object-cover" />,
    );
    const img = container.querySelector('img');
    expect(img?.className).toBe('object-cover');
    expect(img?.style.position, 'fill mode must pin the image to its positioned parent').toBe(
      'absolute',
    );
    expect(img?.style.width).toBe('100%');
    expect(img?.style.height).toBe('100%');
  });

  it('does not preload a lazy image', () => {
    render(<OptimizedImage src={LOCAL_SRC} alt="" width={10} height={10} />);
    expect(preload, 'a lazy image preloaded competes with the LCP request').not.toHaveBeenCalled();
  });

  it('loads a priority image eagerly and preloads the same source set it renders', () => {
    const { container } = render(
      <OptimizedImage src={LOCAL_SRC} alt="" width={56} height={56} sizes="56px" priority />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('loading')).toBeNull();
    expect(preload).toHaveBeenCalledTimes(1);
    const [href, options] = preload.mock.calls[0] ?? [];
    expect(href).toBe(img?.getAttribute('src'));
    expect(options).toMatchObject({
      as: 'image',
      imageSrcSet: img?.getAttribute('srcset'),
      imageSizes: '56px',
    });
  });
});
