export const STREAM_ERR_SENTINEL = '\x00ERR:';

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
