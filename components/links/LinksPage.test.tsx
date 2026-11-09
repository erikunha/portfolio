import { prerender } from 'react-dom/static';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LINKS_LOCALE, type LinksLocale } from '@/content/links.constants';
import type { ChannelFeed } from '@/lib/links/feed';
import { LinksPage } from './LinksPage';

const CHANNEL_URL = 'https://www.youtube.com/@eriknagringa';

const feedState = vi.hoisted(() => ({ current: null as unknown as ChannelFeed }));

vi.mock('@/lib/links/feed', () => ({
  getChannelFeed: () => Promise.resolve(feedState.current),
  EMPTY_FEED: { fetchedAt: null, latest: null, history: [], stats: {}, channelUrl: '' },
  CHANNEL_URL: 'https://www.youtube.com/@eriknagringa',
  HISTORY_LENGTH: 5,
}));

const downFeed: ChannelFeed = {
  fetchedAt: '2026-08-31T19:00:00Z',
  latest: null,
  history: [],
  stats: {},
  channelUrl: CHANNEL_URL,
};

const liveFeed: ChannelFeed = {
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

async function renderPage(locale: LinksLocale, feed: ChannelFeed): Promise<Document> {
  feedState.current = feed;
  const { prelude } = await prerender(<LinksPage locale={locale} />, {
    progressiveChunkSize: Number.POSITIVE_INFINITY,
  });
  const html = await new Response(prelude).text();
  return new DOMParser().parseFromString(html, 'text/html');
}

function groupHeadings(doc: Document): string[] {
  return Array.from(doc.querySelectorAll('main section[aria-labelledby]'), (section) => {
    const id = section.getAttribute('aria-labelledby') ?? '';
    return doc.getElementById(id)?.firstElementChild?.textContent ?? '';
  });
}

describe('LinksPage groups', () => {
  beforeEach(() => {
    feedState.current = liveFeed;
  });

  it.each([
    [
      LINKS_LOCALE.pt,
      ['assistir', 'últimos vídeos', 'playlists', 'perfis', 'contato', 'levar a página com você'],
    ],
    [
      LINKS_LOCALE.en,
      ['watch', 'latest videos', 'playlists', 'profiles', 'contact', 'take this page with you'],
    ],
  ])(
    'lists the groups in reading order, each a section named by its heading (%s)',
    async (locale, headings) => {
      const doc = await renderPage(locale, liveFeed);
      expect(groupHeadings(doc).map((text) => text.toLowerCase())).toEqual(headings);
      for (const section of doc.querySelectorAll('main section[aria-labelledby]')) {
        expect(section.querySelector('h2')?.id).toBe(section.getAttribute('aria-labelledby'));
      }
    },
  );

  it('renders the profile rows and leaves out a profile with no destination', async () => {
    const doc = await renderPage(LINKS_LOCALE.pt, liveFeed);
    const rows = Array.from(
      doc.querySelectorAll('section[data-col="profiles"] a'),
      (link) => link.querySelector('.links-line-label')?.textContent,
    );
    expect(rows).toEqual(['Portfólio', 'GitHub', 'LinkedIn', 'TikTok']);
    expect(doc.body.textContent).not.toMatch(/instagram/i);
  });

  it('puts the e-mail and the copy-link control in the contact group', async () => {
    const doc = await renderPage(LINKS_LOCALE.en, liveFeed);
    const contact = doc.querySelector('section[data-col="contact"]');
    expect(contact?.querySelector('a[href^="mailto:"]')).not.toBeNull();
    expect(contact?.querySelector('button')).not.toBeNull();
  });

  it('puts the watch group before the profiles in the source, so reading and tab order agree on a phone', async () => {
    const doc = await renderPage(LINKS_LOCALE.pt, liveFeed);
    const channel = doc.querySelector('[data-col="channel"]');
    const profiles = doc.querySelector('[data-col="profiles"]');
    const follows = channel?.compareDocumentPosition(profiles as Node);
    expect(((follows ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
  });

  it('keeps the feed-down copy and every group when the latest video is missing', async () => {
    const doc = await renderPage(LINKS_LOCALE.pt, downFeed);
    expect(doc.querySelector('[data-col="channel"]')?.textContent).toContain(
      'O último vídeo não carregou agora',
    );
    expect(groupHeadings(doc)).toContain('perfis');
    expect(doc.querySelector('a[data-outbound="ultimo-video-titulo"]')).toBeNull();
  });

  it('hides the description block when the video has none', async () => {
    const doc = await renderPage(LINKS_LOCALE.pt, {
      ...liveFeed,
      latest: liveFeed.latest && { ...liveFeed.latest, description: '' },
    });
    expect(doc.querySelector('.links-watch-desc')?.hasAttribute('hidden')).toBe(true);
  });
});
