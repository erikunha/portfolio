import { render } from '@testing-library/react';
import { parse } from 'postcss';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesWithSelector } from '@/__tests__/helpers/css-rules';
import { LINKS_LOCALE } from '@/content/links.constants';
import type { ChannelFeed } from '@/lib/links/feed';
import { LatestVideoSkeleton } from './LatestVideoSkeleton';

const feedPending = Promise.withResolvers<ChannelFeed>();
vi.mock('@/lib/links/feed', () => ({
  getChannelFeed: () => feedPending.promise,
  EMPTY_FEED: { fetchedAt: null, latest: null, history: [], stats: {}, channelUrl: '' },
  CHANNEL_URL: 'https://www.youtube.com/@eriknagringa',
  HISTORY_LENGTH: 5,
}));

describe('LatestVideoSkeleton', () => {
  it.each([
    [LINKS_LOCALE.en, 'Loading the latest video'],
    [LINKS_LOCALE.pt, 'Carregando o vídeo mais recente'],
  ])('announces itself as a labelled status (%s)', (locale, label) => {
    const { getByRole } = render(<LatestVideoSkeleton locale={locale} />);
    expect(getByRole('status').getAttribute('aria-label')).toBe(label);
  });

  it('draws a 16:9 thumbnail block and three text bars, all hidden from assistive tech', () => {
    const { container } = render(<LatestVideoSkeleton locale={LINKS_LOCALE.en} />);
    const thumb = container.querySelector('.links-skeleton-thumb');
    const bars = container.querySelectorAll('.links-skeleton-bar');
    expect(thumb?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(bars).toHaveLength(3);
    for (const bar of bars) expect(bar.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shapes the blocks like the final card and paints CRT scanlines from tokens only', () => {
    // behavioral-test-allow: block shape and scanline paint live in the shipped stylesheet; jsdom has no layout or paint
    const stylesheet = parse(readComponentsCss());
    const thumb = rulesWithSelector(stylesheet, '.links-skeleton-thumb');
    expect(thumb.map((rule) => declValue(rule, 'aspect-ratio'))).toContain('16 / 9');
    const scanlines = rulesWithSelector(stylesheet, '.links-skeleton-block')
      .map((rule) => declValue(rule, 'background-image') ?? '')
      .join(' ');
    expect(scanlines).toContain('repeating-linear-gradient');
    expect(scanlines).toContain('var(--color-');
    expect(scanlines).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
  });
});

describe('LatestVideoSkeleton: the two columns it stands in for', () => {
  it.each([
    [LINKS_LOCALE.en, 'WATCH', 'LATEST VIDEOS'],
    [LINKS_LOCALE.pt, 'ASSISTIR', 'ÚLTIMOS VÍDEOS'],
  ])(
    'names both blocks with their real headings, untyped, so the swap does not retype them (%s)',
    (locale, channel, latest) => {
      const { container } = render(<LatestVideoSkeleton locale={locale} />);
      const headings = Array.from(container.querySelectorAll('h2'), (heading) =>
        heading.textContent?.toUpperCase(),
      );
      expect(headings[0]).toContain(channel);
      expect(headings[1]).toContain(latest);
      expect(container.querySelector('[data-type-reveal]')).toBeNull();
    },
  );

  it('marks the channel block busy and keeps the history block out of the accessibility tree', () => {
    const { container } = render(<LatestVideoSkeleton locale={LINKS_LOCALE.en} />);
    expect(container.querySelector('[data-col="channel-loading"]')?.getAttribute('aria-busy')).toBe(
      'true',
    );
    expect(
      container.querySelector('[data-col="history-loading"]')?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it('draws as many history rows as a full feed holds, so the list lands without a shift', () => {
    const { container } = render(<LatestVideoSkeleton locale={LINKS_LOCALE.en} />);
    expect(container.querySelectorAll('.links-history-item')).toHaveLength(5);
  });

  it('reserves the subscribe row and the see-all row the final blocks end with', () => {
    const { container } = render(<LatestVideoSkeleton locale={LINKS_LOCALE.en} />);
    expect(container.querySelector('.links-skeleton-action')).not.toBeNull();
    expect(container.querySelector('.links-skeleton-all')).not.toBeNull();
  });
});

describe('LinksPage: latest video loading', () => {
  it('renders the static shell and the skeleton while the feed is still pending', async () => {
    const { LinksPage } = await import('./LinksPage');
    const element = LinksPage({ locale: LINKS_LOCALE.en });
    expect(element).not.toBeInstanceOf(Promise);
    const doc = new DOMParser().parseFromString(renderToStaticMarkup(element), 'text/html');
    expect(doc.querySelector('.links-grid')).not.toBeNull();
    expect(doc.querySelector('[data-stack="primary"]')).not.toBeNull();
    expect(
      doc.querySelector('[role="status"][aria-label="Loading the latest video"]'),
    ).not.toBeNull();
    expect(doc.querySelector('[data-col="channel"]')).toBeNull();
    expect(doc.querySelector('[data-col="history"]')).toBeNull();
  });

  it('swaps the skeleton for the channel card, history and playlists once the feed lands', async () => {
    const { LinksPage } = await import('./LinksPage');
    feedPending.resolve({
      fetchedAt: '2026-08-31T19:00:00Z',
      latest: null,
      history: [],
      stats: {},
      channelUrl: 'https://www.youtube.com/@eriknagringa',
    });
    const { PassThrough } = await import('node:stream');
    const { renderToPipeableStream } = await import('react-dom/server');
    const stream = new PassThrough();
    let html = '';
    stream.on('data', (chunk) => {
      html += chunk.toString();
    });
    const ended = new Promise<void>((resolve) => stream.on('end', resolve));
    const pipe = renderToPipeableStream(<LinksPage locale={LINKS_LOCALE.en} />, {
      onAllReady() {
        pipe.pipe(stream);
      },
    });
    await ended;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('[data-col="channel"]')).not.toBeNull();
    expect(doc.querySelector('[data-col="history"]')).not.toBeNull();
    expect(doc.querySelector('[data-col="playlists"]')).not.toBeNull();
  });
});
