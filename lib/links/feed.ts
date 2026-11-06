import 'server-only';

import { readFile } from 'node:fs/promises';
import { cacheLife } from 'next/cache';
import { z } from 'zod';
import { linksContent } from '@/content/links';
import { env } from '@/lib/env';
import { GOOGLE_API_KEY_HEADER } from '@/lib/google-api';
import {
  canonicalThumbnailUrl,
  type EnrichedVideo,
  isShort,
  isShortUrl,
  type PlaylistItemsPayload,
  parseFeed,
  parseIsoDuration,
  parsePlaylistItems,
} from '@/lib/links/youtube';
import { log } from '@/lib/log';

export const HISTORY_LENGTH = 5;
export const FEED_LIMIT = HISTORY_LENGTH + 1;
const FEED_CANDIDATES = 15;
const UPLOADS_PAGE_SIZE = 50;
const UPLOADS_MAX_PAGES = 4;

const FEED_DEADLINE_MS = 12_000;
const FEED_TIMEOUT_MS = 6_000;
const API_TIMEOUT_MS = 6_000;
const CACHE_STALE_S = 900;
const CACHE_REVALIDATE_S = 3_600;
const CACHE_EXPIRE_S = 86_400;

const RSS_ENDPOINT = 'https://www.youtube.com/feeds/videos.xml';
const VIDEOS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
const CHANNELS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/channels';
const PLAYLIST_ITEMS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/playlistItems';
const CHANNEL_ID_PREFIX = 'UC';
const UPLOADS_PLAYLIST_PREFIX = 'UU';

export type ChannelStats = {
  subscriberCount?: number;
  videoCount?: number;
};

export type ChannelFeed = {
  fetchedAt: string | null;
  latest: EnrichedVideo | null;
  history: EnrichedVideo[];
  stats: ChannelStats;
  channelUrl: string;
};

const VideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  thumbnailUrl: z.string(),
  publishedAt: z.string(),
  description: z.string().optional(),
  duration: z.string().optional(),
  viewCount: z.number().optional(),
});

const ChannelFeedSchema = z.object({
  fetchedAt: z.string().nullable(),
  latest: VideoSchema.nullable(),
  history: z.array(VideoSchema),
  stats: z.object({
    subscriberCount: z.number().optional(),
    videoCount: z.number().optional(),
  }),
  channelUrl: z.string(),
});

export const CHANNEL_URL = `https://www.youtube.com/${linksContent.channel.handle}`;

export const EMPTY_FEED: ChannelFeed = {
  fetchedAt: null,
  latest: null,
  history: [],
  stats: {},
  channelUrl: CHANNEL_URL,
};

type ApiVideoItem = {
  id?: string;
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
};

type ApiChannelItem = {
  statistics?: { subscriberCount?: string; videoCount?: string };
};

async function fetchText(
  url: string,
  timeoutMs: number,
  deadline: AbortSignal,
  apiKey?: string,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), deadline]),
      headers: {
        accept: 'application/xml, application/json',
        ...(apiKey ? { [GOOGLE_API_KEY_HEADER]: apiKey } : {}),
      },
    });
    if (!response.ok) {
      log.warn('links feed upstream returned non-ok', { status: response.status });
      return null;
    }
    return await response.text();
  } catch (err) {
    log.warn('links feed upstream unreachable', { err });
    return null;
  }
}

async function fetchJson<T>(
  url: string,
  timeoutMs: number,
  deadline: AbortSignal,
  apiKey: string,
): Promise<T | null> {
  const body = await fetchText(url, timeoutMs, deadline, apiKey);
  if (body === null) return null;
  try {
    return JSON.parse(body) as T;
  } catch (err) {
    log.warn('links feed upstream returned unparseable json', { err });
    return null;
  }
}

async function enrich(
  videos: EnrichedVideo[],
  apiKey: string,
  deadline: AbortSignal,
): Promise<EnrichedVideo[] | null> {
  const ids = videos.map((v) => v.id).join(',');
  const url = `${VIDEOS_ENDPOINT}?part=contentDetails,statistics&id=${encodeURIComponent(ids)}`;
  const payload = await fetchJson<{ items?: ApiVideoItem[] }>(
    url,
    API_TIMEOUT_MS,
    deadline,
    apiKey,
  );
  if (!payload?.items) return null;

  const byId = new Map(payload.items.map((item) => [item.id, item]));
  return videos.map((video) => {
    const item = byId.get(video.id);
    if (!item) return video;
    const enriched: EnrichedVideo = { ...video };
    const duration = item.contentDetails?.duration
      ? parseIsoDuration(item.contentDetails.duration)
      : null;
    if (duration !== null) enriched.duration = duration;
    const views = Number(item.statistics?.viewCount);
    if (Number.isFinite(views)) enriched.viewCount = views;
    return enriched;
  });
}

async function fetchStats(
  channelId: string,
  apiKey: string,
  deadline: AbortSignal,
): Promise<ChannelStats> {
  const url = `${CHANNELS_ENDPOINT}?part=statistics&id=${encodeURIComponent(channelId)}`;
  const payload = await fetchJson<{ items?: ApiChannelItem[] }>(
    url,
    API_TIMEOUT_MS,
    deadline,
    apiKey,
  );
  const statistics = payload?.items?.[0]?.statistics;
  if (!statistics) return {};

  const stats: ChannelStats = {};
  const subscribers = Number(statistics.subscriberCount);
  if (Number.isFinite(subscribers)) stats.subscriberCount = subscribers;
  const videos = Number(statistics.videoCount);
  if (Number.isFinite(videos)) stats.videoCount = videos;
  return stats;
}

function uploadsPlaylistId(channelId: string): string {
  return channelId.startsWith(CHANNEL_ID_PREFIX)
    ? `${UPLOADS_PLAYLIST_PREFIX}${channelId.slice(CHANNEL_ID_PREFIX.length)}`
    : channelId;
}

async function fetchUploadsPage(
  uploadsId: string,
  apiKey: string,
  deadline: AbortSignal,
  pageToken?: string,
): Promise<PlaylistItemsPayload | null> {
  const token = pageToken === undefined ? '' : `&pageToken=${encodeURIComponent(pageToken)}`;
  const url = `${PLAYLIST_ITEMS_ENDPOINT}?part=snippet,status&maxResults=${UPLOADS_PAGE_SIZE}&playlistId=${encodeURIComponent(uploadsId)}${token}`;
  return fetchJson<PlaylistItemsPayload>(url, API_TIMEOUT_MS, deadline, apiKey);
}

async function fetchDeepUploads(
  channelId: string,
  apiKey: string,
  deadline: AbortSignal,
): Promise<EnrichedVideo[]> {
  const uploadsId = uploadsPlaylistId(channelId);
  const regular: EnrichedVideo[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < UPLOADS_MAX_PAGES && regular.length < HISTORY_LENGTH; page += 1) {
    const payload = await fetchUploadsPage(uploadsId, apiKey, deadline, pageToken);
    if (!payload) break;
    const pageVideos = parsePlaylistItems(payload, UPLOADS_PAGE_SIZE).filter(
      (video) => !isShortUrl(video),
    );
    const checked = await enrich(pageVideos, apiKey, deadline);
    if (checked === null) {
      log.warn('links feed stopped paging uploads because their lengths could not be checked');
      break;
    }
    for (const video of checked) {
      if (!isShort(video)) regular.push(video);
    }
    const next = payload.nextPageToken;
    if (typeof next !== 'string' || next.length === 0) break;
    pageToken = next;
  }
  return regular;
}

export const FEED_FIXTURE_ENV = 'E2E_LINKS_FEED_FIXTURE';

export async function loadFixtureFeed(
  vars: Record<string, string | undefined> = process.env,
): Promise<ChannelFeed | null> {
  const path = vars[FEED_FIXTURE_ENV];
  if (!path || vars.VERCEL) return null;
  const fixture: ChannelFeed = ChannelFeedSchema.parse(
    JSON.parse(await readFile(path, 'utf8')),
  ) as ChannelFeed;
  return {
    ...fixture,
    latest: fixture.latest
      ? { ...fixture.latest, thumbnailUrl: canonicalThumbnailUrl(fixture.latest.thumbnailUrl) }
      : null,
    history: fixture.history.map((video) => ({
      ...video,
      thumbnailUrl: canonicalThumbnailUrl(video.thumbnailUrl),
    })),
  };
}

export async function getChannelFeed(): Promise<ChannelFeed> {
  'use cache';
  cacheLife({ stale: CACHE_STALE_S, revalidate: CACHE_REVALIDATE_S, expire: CACHE_EXPIRE_S });

  const fixture = await loadFixtureFeed();
  if (fixture) return fixture;

  const channelId = linksContent.channel.id;
  const apiKey = env.YOUTUBE_API_KEY;
  const controller = new AbortController();
  const deadlineTimer = setTimeout(() => controller.abort(), FEED_DEADLINE_MS);
  try {
    return await loadChannelFeed(channelId, apiKey, controller.signal);
  } finally {
    clearTimeout(deadlineTimer);
  }
}

async function loadChannelFeed(
  channelId: string,
  apiKey: string | undefined,
  deadline: AbortSignal,
): Promise<ChannelFeed> {
  const [stats, deepVideos] = await Promise.all([
    apiKey ? fetchStats(channelId, apiKey, deadline) : ({} as ChannelStats),
    apiKey ? fetchDeepUploads(channelId, apiKey, deadline) : ([] as EnrichedVideo[]),
  ]);

  let videos = deepVideos;
  if (videos.length === 0) {
    if (apiKey) {
      log.info('links feed fell back to the RSS feed after the uploads playlist returned nothing');
    }
    const xml = await fetchText(
      `${RSS_ENDPOINT}?channel_id=${encodeURIComponent(channelId)}`,
      FEED_TIMEOUT_MS,
      deadline,
    );
    const rssVideos: EnrichedVideo[] = xml === null ? [] : parseFeed(xml, FEED_CANDIDATES);
    const urlFiltered = rssVideos.filter((video) => !isShortUrl(video));
    const checked =
      apiKey && urlFiltered.length > 0 ? await enrich(urlFiltered, apiKey, deadline) : null;
    videos = checked ?? urlFiltered;
  }

  const resolved = videos.filter((video) => !isShort(video)).slice(0, FEED_LIMIT);

  if (resolved.length === 0) return { ...EMPTY_FEED, stats, fetchedAt: new Date().toISOString() };

  return {
    fetchedAt: new Date().toISOString(),
    latest: resolved[0] ?? null,
    history: resolved.slice(0, HISTORY_LENGTH),
    stats,
    channelUrl: CHANNEL_URL,
  };
}
