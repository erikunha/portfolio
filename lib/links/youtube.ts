export type FeedVideo = {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: string;
  description?: string;
};

export type EnrichedVideo = FeedVideo & {
  duration?: string;
  viewCount?: number;
};

const ENTRY_RE = /<entry\b[^>]*>([\s\S]*?)<\/entry>/g;
const VIDEO_ID_RE = /<yt:videoId>([^<]+)<\/yt:videoId>/;
const TITLE_RE = /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/;
const LINK_RE = /<link\b[^>]*rel="alternate"[^>]*href="([^"]+)"/;
const PUBLISHED_RE = /<published>([^<]+)<\/published>/;
const THUMBNAIL_RE = /<media:thumbnail\b[^>]*url="([^"]+)"/;
const DESCRIPTION_RE = /<media:description>([\s\S]*?)<\/media:description>/;
const ISO_DURATION_RE = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

const PAD_WIDTH = 2;

const YTIMG_SHARD_HOST_RE = /^https:\/\/i\d\.ytimg\.com\//;
const YTIMG_CANONICAL_ORIGIN = 'https://i.ytimg.com/';

export function canonicalThumbnailUrl(url: string): string {
  return url.replace(YTIMG_SHARD_HOST_RE, YTIMG_CANONICAL_ORIGIN);
}

export function decodeXmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .trim();
}

function firstGroup(source: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(source);
  const value = match?.[1];
  return value === undefined ? undefined : decodeXmlText(value);
}

export function parseFeed(xml: string, limit = Number.POSITIVE_INFINITY): FeedVideo[] {
  const videos: FeedVideo[] = [];
  ENTRY_RE.lastIndex = 0;
  for (const match of xml.matchAll(ENTRY_RE)) {
    if (videos.length >= limit) break;
    const entry = match[1];
    if (entry === undefined) continue;

    const id = firstGroup(entry, VIDEO_ID_RE);
    const title = firstGroup(entry, TITLE_RE);
    const publishedAt = firstGroup(entry, PUBLISHED_RE);
    if (!id || !title || !publishedAt) continue;

    const url = firstGroup(entry, LINK_RE) ?? `https://www.youtube.com/watch?v=${id}`;
    const feedThumbnail = firstGroup(entry, THUMBNAIL_RE);
    const thumbnailUrl =
      feedThumbnail === undefined
        ? `${YTIMG_CANONICAL_ORIGIN}vi/${id}/hqdefault.jpg`
        : canonicalThumbnailUrl(feedThumbnail);
    const description = firstGroup(entry, DESCRIPTION_RE);

    const video: FeedVideo = { id, title, url, thumbnailUrl, publishedAt };
    if (description) video.description = description;
    videos.push(video);
  }
  return videos;
}

const SHORTS_PATH = '/shorts/';
const SHORT_MAX_SECONDS = 60;
const SECONDS_PER_MINUTE = 60;

export function durationSeconds(formatted: string): number | null {
  const parts = formatted.split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  return parts.reduce((total, part) => total * SECONDS_PER_MINUTE + part, 0);
}

export function isShortUrl(video: FeedVideo): boolean {
  return video.url.includes(SHORTS_PATH);
}

export function isShort(video: EnrichedVideo): boolean {
  if (isShortUrl(video)) return true;
  const seconds = video.duration === undefined ? null : durationSeconds(video.duration);
  return seconds !== null && seconds <= SHORT_MAX_SECONDS;
}

export function parseIsoDuration(iso: string): string | null {
  const match = ISO_DURATION_RE.exec(iso);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  if (hours === undefined && minutes === undefined && seconds === undefined) return null;

  const h = Number(hours ?? 0);
  const m = Number(minutes ?? 0);
  const s = Number(seconds ?? 0);
  const pad = (value: number) => String(value).padStart(PAD_WIDTH, '0');

  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export type PlaylistItemsPayload = {
  items?: Array<{
    snippet?: {
      title?: string;
      publishedAt?: string;
      description?: string;
      resourceId?: { videoId?: string };
    };
    status?: { privacyStatus?: string };
  }>;
};

const PUBLIC_PRIVACY_STATUS = 'public';

export function parsePlaylistItems(
  payload: PlaylistItemsPayload,
  limit = Number.POSITIVE_INFINITY,
): FeedVideo[] {
  const videos: FeedVideo[] = [];
  for (const item of payload.items ?? []) {
    if (videos.length >= limit) break;
    if (item.status?.privacyStatus !== PUBLIC_PRIVACY_STATUS) continue;
    const id = item.snippet?.resourceId?.videoId;
    const title = item.snippet?.title;
    const publishedAt = item.snippet?.publishedAt;
    if (!id || !title || !publishedAt) continue;

    const video: FeedVideo = {
      id,
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: `${YTIMG_CANONICAL_ORIGIN}vi/${id}/hqdefault.jpg`,
      publishedAt,
    };
    if (item.snippet?.description) video.description = item.snippet.description;
    videos.push(video);
  }
  return videos;
}
