import { describe, expect, it } from 'vitest';
import { parseFeed, parseIsoDuration } from '@/lib/links/youtube';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Erik na Gringa</title>
  <entry>
    <yt:videoId>dQw4w9WgXcQ</yt:videoId>
    <title>Montei um time de 12 agentes &amp; ele fez a sprint</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"/>
    <published>2026-08-28T19:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" width="480" height="360"/>
      <media:description>O setup completo de context engineering.</media:description>
    </media:group>
  </entry>
  <entry>
    <yt:videoId>abc12345678</yt:videoId>
    <title>Segundo vídeo</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc12345678"/>
    <published>2026-08-20T19:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://i.ytimg.com/vi/abc12345678/hqdefault.jpg" width="480" height="360"/>
    </media:group>
  </entry>
</feed>`;

describe('parseFeed', () => {
  it('reads every entry in document order', () => {
    const videos = parseFeed(FEED);
    expect(videos.map((v) => v.id)).toEqual(['dQw4w9WgXcQ', 'abc12345678']);
  });

  it('decodes XML entities in the title so "&amp;" never reaches the DOM as text', () => {
    expect(parseFeed(FEED)[0]?.title).toBe('Montei um time de 12 agentes & ele fez a sprint');
  });

  it('carries the watch url, thumbnail and published date', () => {
    const first = parseFeed(FEED)[0];
    expect(first?.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(first?.thumbnailUrl).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(first?.publishedAt).toBe('2026-08-28T19:00:00+00:00');
  });

  it('leaves description undefined when the entry omits it rather than inventing one', () => {
    expect(parseFeed(FEED)[1]?.description).toBeUndefined();
  });

  it('reports no videos for a malformed feed instead of throwing into the render', () => {
    expect(parseFeed('<html>404</html>')).toEqual([]);
    expect(parseFeed('')).toEqual([]);
  });

  it('skips an entry with no video id — an entry it cannot link to is not a video', () => {
    const broken = FEED.replace('<yt:videoId>dQw4w9WgXcQ</yt:videoId>', '');
    expect(parseFeed(broken).map((v) => v.id)).toEqual(['abc12345678']);
  });
});

describe('parseIsoDuration', () => {
  it('formats minutes and seconds', () => {
    expect(parseIsoDuration('PT14M32S')).toBe('14:32');
  });

  it('formats hours', () => {
    expect(parseIsoDuration('PT1H2M3S')).toBe('1:02:03');
  });

  it('pads a bare seconds duration', () => {
    expect(parseIsoDuration('PT7S')).toBe('0:07');
  });

  it('returns null for an unparseable duration so the field is omitted, not zeroed', () => {
    expect(parseIsoDuration('')).toBeNull();
    expect(parseIsoDuration('14:32')).toBeNull();
  });
});
