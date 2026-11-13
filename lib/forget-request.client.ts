'use client';

import { postJson } from '@/lib/post-json';
import { removeRef } from '@/lib/request-refs.client';
import { parseRetryAfter, RETRY_AFTER_HEADER } from '@/lib/stream-protocol';

export const FORGET_ENDPOINT = '/api/log/forget';
export const FORGET_TIMEOUT_MS = 20_000;

const ABORT_ERROR_NAME = 'AbortError';
const STATUS = { ok: 200, rateLimited: 429, unavailable: 503 } as const;

export const FORGET_OUTCOME = {
  Deleted: 'deleted',
  RateLimited: 'rate-limited',
  Unavailable: 'unavailable',
  Offline: 'offline',
  TimedOut: 'timed-out',
  Failed: 'failed',
} as const;

export type ForgetResult =
  | { outcome: typeof FORGET_OUTCOME.Deleted }
  | { outcome: typeof FORGET_OUTCOME.RateLimited; retryAfter: number | null }
  | { outcome: typeof FORGET_OUTCOME.Unavailable }
  | { outcome: typeof FORGET_OUTCOME.Offline }
  | { outcome: typeof FORGET_OUTCOME.TimedOut }
  | { outcome: typeof FORGET_OUTCOME.Failed };

export type ForgetBatch = {
  results: { id: string; result: ForgetResult }[];
  unattempted: string[];
};

export function wasForgotten(result: ForgetResult): boolean {
  return result.outcome === FORGET_OUTCOME.Deleted;
}

export async function forgetRequest(id: string): Promise<ForgetResult> {
  let result: ForgetResult;
  try {
    const { response } = await postJson(
      FORGET_ENDPOINT,
      { requestId: id },
      { timeoutMs: FORGET_TIMEOUT_MS },
    );
    if (response.status === STATUS.ok) result = { outcome: FORGET_OUTCOME.Deleted };
    else if (response.status === STATUS.rateLimited) {
      result = {
        outcome: FORGET_OUTCOME.RateLimited,
        retryAfter: parseRetryAfter(response.headers.get(RETRY_AFTER_HEADER)),
      };
    } else if (response.status === STATUS.unavailable) {
      result = { outcome: FORGET_OUTCOME.Unavailable };
    } else result = { outcome: FORGET_OUTCOME.Failed };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === ABORT_ERROR_NAME;
    result = { outcome: timedOut ? FORGET_OUTCOME.TimedOut : FORGET_OUTCOME.Offline };
  }
  if (wasForgotten(result)) removeRef(id);
  return result;
}

export async function forgetMany(
  ids: readonly string[],
  forget: (id: string) => Promise<ForgetResult> = forgetRequest,
): Promise<ForgetBatch> {
  const results: ForgetBatch['results'] = [];
  for (const [index, id] of ids.entries()) {
    const result = await forget(id);
    results.push({ id, result });
    if (result.outcome === FORGET_OUTCOME.RateLimited) {
      return { results, unattempted: ids.slice(index + 1) };
    }
  }
  return { results, unattempted: [] };
}
