import { MS_PER_SECOND } from './time';

export const STREAM_ERR_SENTINEL = '\x00ERR:';

export const GUARD_ABORT_PREFIX = 'output guard: ';

export const ASK_LOCALE_HEADER = 'x-site-locale';

export const REQUEST_ID_HEADER = 'X-Request-Id';

export type ParsedStreamChunk =
  | { ok: true; displayText: string }
  | { ok: false; displayText: string; errorMessage: string };

export function parseStreamChunk(accumulated: string): ParsedStreamChunk {
  const sentinelIdx = accumulated.indexOf(STREAM_ERR_SENTINEL);
  if (sentinelIdx === -1) {
    return { ok: true, displayText: accumulated.trim() };
  }
  const displayText = accumulated.slice(0, sentinelIdx).trim();
  const rawError = accumulated.slice(sentinelIdx + STREAM_ERR_SENTINEL.length).trim();
  return { ok: false, displayText, errorMessage: rawError || 'upstream error' };
}

export const RETRY_AFTER_HEADER = 'Retry-After';

export function retryAfterSeconds(resetMs: unknown, nowMs: number): number | null {
  if (typeof resetMs !== 'number' || !Number.isFinite(resetMs)) return null;
  return Math.max(1, Math.ceil((resetMs - nowMs) / MS_PER_SECOND));
}

export function parseRetryAfter(header: string | null): number | null {
  if (header === null || !/^\d+$/.test(header.trim())) return null;
  const seconds = Number(header);
  return seconds > 0 ? seconds : null;
}
