import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';
import { linksContent } from '@/content/links';
import { env } from '@/lib/env';
import { type EnrichedVideo, parseFeed, parseIsoDuration } from '@/lib/links/youtube';
import { log } from '@/lib/log';

export const LINKS_FEED_TAG = 'links-feed';
export const HISTORY_LENGTH = 5;
export const FEED_LIMIT = HISTORY_LENGTH + 1;

const FEED_TIMEOUT_MS = 6_000;
const API_TIMEOUT_MS = 6_000;
const CACHE_STALE_S = 900;
const CACHE_REVALIDATE_S = 3_600;
const CACHE_EXPIRE_S = 86_400;

const RSS_ENDPOINT = 'https://www.youtube.com/feeds/videos.xml';
const VIDEOS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
const CHANNELS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/channels';

export type ChannelStats = {
  subscriberCount?: number;
  videoCount?: number;
};

export type ChannelFeed = {
  available: boolean;
  latest: EnrichedVideo | null;
  history: EnrichedVideo[];
  stats: ChannelStats;
  channelUrl: string;
};

export const CHANNEL_URL = `https://www.youtube.com/${linksContent.channel.handle}`;

export const EMPTY_FEED: ChannelFeed = {
  available: false,
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

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/xml, application/json' },
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

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  const body = await fetchText(url, timeoutMs);
  if (body === null) return null;
  try {
    return JSON.parse(body) as T;
  } catch (err) {
    log.warn('links feed upstream returned unparseable json', { err });
    return null;
  }
}

async function enrich(videos: EnrichedVideo[], apiKey: string): Promise<EnrichedVideo[]> {
  const ids = videos.map((v) => v.id).join(',');
  const url = `${VIDEOS_ENDPOINT}?part=contentDetails,statistics&id=${encodeURIComponent(ids)}&key=${encodeURIComponent(apiKey)}`;
  const payload = await fetchJson<{ items?: ApiVideoItem[] }>(url, API_TIMEOUT_MS);
  if (!payload?.items) return videos;

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

async function fetchStats(channelId: string, apiKey: string): Promise<ChannelStats> {
  const url = `${CHANNELS_ENDPOINT}?part=statistics&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`;
  const payload = await fetchJson<{ items?: ApiChannelItem[] }>(url, API_TIMEOUT_MS);
  const statistics = payload?.items?.[0]?.statistics;
  if (!statistics) return {};

  const stats: ChannelStats = {};
  const subscribers = Number(statistics.subscriberCount);
  if (Number.isFinite(subscribers)) stats.subscriberCount = subscribers;
  const videos = Number(statistics.videoCount);
  if (Number.isFinite(videos)) stats.videoCount = videos;
  return stats;
}

export async function getChannelFeed(): Promise<ChannelFeed> {
  'use cache';
  cacheTag(LINKS_FEED_TAG);
  cacheLife({ stale: CACHE_STALE_S, revalidate: CACHE_REVALIDATE_S, expire: CACHE_EXPIRE_S });

  const channelId = linksContent.channel.id;
  const apiKey = env.YOUTUBE_API_KEY;

  const xml = await fetchText(
    `${RSS_ENDPOINT}?channel_id=${encodeURIComponent(channelId)}`,
    FEED_TIMEOUT_MS,
  );
  const videos: EnrichedVideo[] = xml === null ? [] : parseFeed(xml, FEED_LIMIT);
  const stats = apiKey ? await fetchStats(channelId, apiKey) : {};

  if (videos.length === 0) return { ...EMPTY_FEED, stats };

  const resolved = apiKey ? await enrich(videos, apiKey) : videos;

  return {
    available: true,
    latest: resolved[0] ?? null,
    history: resolved.slice(0, HISTORY_LENGTH),
    stats,
    channelUrl: CHANNEL_URL,
  };
}
