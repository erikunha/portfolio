import type { NextRequest } from 'next/server';
import { EMAIL_ADDRESS } from '@/content/social-urls';
import { env } from '@/lib/env';
import { HTTP_STATUS } from '@/lib/http-status';
import { log } from '@/lib/log';
import { sendMail } from '@/lib/mail';
import { getRedis } from '@/lib/redis';
import { requireCron } from '@/lib/server/cron-auth';
import { err, ok } from '@/lib/server/route';
import { HOURS_PER_DAY, MS_PER_HOUR, utcDay } from '@/lib/time';

const ERR_KEY_PREFIX = 'err';
const ERR_COUNT_KEY_PREFIX = 'errn';
const ERR_LATEST_KEY_PREFIX = 'errlast';
const ERR_SEEN_KEY_PREFIX = 'errseen';
const ERR_DAY_INDEX_KEY_PREFIX = 'errday';
const KEY_SEPARATOR = ':';
const RELEASE_INDEX = 1;
const FINGERPRINT_INDEX = 3;
const KEY_PARTS = 4;
const INDEX_PAGE_SIZE = 200;
const MAX_INDEX_PAGES = 50;
const INDEX_DONE_CURSOR = '0';
const INDEX_MEMBER_PARTS = 2;
const MGET_CHUNK_SIZE = 100;
const OVER_THRESHOLD_COUNT = 20;
const SEEN_TTL_S = 30 * HOURS_PER_DAY * 3600;
const MAX_LISTED_FINGERPRINTS = 25;
const MAX_MESSAGE_CHARS = 160;
const UNKNOWN_MESSAGE = '(message unavailable)';
const URL_PLACEHOLDER = '<url>';
const MAIL_TIMEOUT_MS = 5_000;
const ERROR_DIGEST_FROM = 'alerts@erikunha.dev';
const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR;
const WHITESPACE_PATTERN = /\s+/g;
const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;

export const maxDuration = 60;

interface FingerprintTotal {
  fingerprint: string;
  message: string;
  count: number;
  releases: Set<string>;
  isNew: boolean;
}

function chunked<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

async function readAll(keys: readonly string[]): Promise<unknown[]> {
  const redis = getRedis();
  const values: unknown[] = [];
  for (const chunk of chunked(keys, MGET_CHUNK_SIZE)) {
    values.push(...(await redis.mget<unknown[]>(...chunk)));
  }
  return values;
}

interface DayIndex {
  keys: string[];
  truncated: boolean;
}

function recordKeyOfMember(day: string, member: unknown): string | undefined {
  if (typeof member !== 'string') return undefined;
  const parts = member.split(KEY_SEPARATOR);
  if (parts.length !== INDEX_MEMBER_PARTS || parts.some((part) => part === '')) return undefined;
  const [release, fingerprint] = parts;
  return [ERR_KEY_PREFIX, release, day, fingerprint].join(KEY_SEPARATOR);
}

async function readDayIndex(day: string): Promise<DayIndex> {
  const redis = getRedis();
  const indexKey = `${ERR_DAY_INDEX_KEY_PREFIX}${KEY_SEPARATOR}${day}`;
  const keys: string[] = [];
  let cursor = INDEX_DONE_CURSOR;
  for (let page = 0; page < MAX_INDEX_PAGES; page += 1) {
    const [next, batch] = await redis.sscan(indexKey, cursor, { count: INDEX_PAGE_SIZE });
    for (const member of batch) {
      const key = recordKeyOfMember(day, member);
      if (key) keys.push(key);
    }
    cursor = String(next);
    if (cursor === INDEX_DONE_CURSOR) break;
  }
  return { keys, truncated: cursor !== INDEX_DONE_CURSOR };
}

function messageOf(record: unknown): string {
  if (typeof record === 'string') {
    try {
      return messageOf(JSON.parse(record));
    } catch {
      return UNKNOWN_MESSAGE;
    }
  }
  if (record && typeof record === 'object' && 'message' in record) {
    const { message } = record;
    if (typeof message === 'string') {
      return message
        .replace(URL_PATTERN, URL_PLACEHOLDER)
        .replace(WHITESPACE_PATTERN, ' ')
        .trim()
        .slice(0, MAX_MESSAGE_CHARS);
    }
  }
  return UNKNOWN_MESSAGE;
}

function repeatsOf(value: unknown): number {
  const repeats = Number(value);
  return Number.isFinite(repeats) && repeats > 0 ? repeats : 0;
}

async function totalsByFingerprint(keys: readonly string[]): Promise<FingerprintTotal[]> {
  const parsed = keys
    .map((key) => ({ key, parts: key.split(KEY_SEPARATOR) }))
    .filter(({ parts }) => parts.length === KEY_PARTS);
  const records = await readAll(parsed.map(({ key }) => key));
  const counters = await readAll(
    parsed.map(({ parts }) =>
      [ERR_COUNT_KEY_PREFIX, ...parts.slice(RELEASE_INDEX)].join(KEY_SEPARATOR),
    ),
  );

  const latest = await readAll(
    parsed.map(({ parts }) =>
      [ERR_LATEST_KEY_PREFIX, ...parts.slice(RELEASE_INDEX)].join(KEY_SEPARATOR),
    ),
  );

  const totals = new Map<string, FingerprintTotal>();
  parsed.forEach(({ parts }, index) => {
    const fingerprint = parts[FINGERPRINT_INDEX] ?? '';
    const release = parts[RELEASE_INDEX] ?? '';
    const total = totals.get(fingerprint) ?? {
      fingerprint,
      message: messageOf(latest[index] ?? records[index]),
      count: 0,
      releases: new Set<string>(),
      isNew: false,
    };
    total.count += 1 + repeatsOf(counters[index]);
    total.releases.add(release);
    totals.set(fingerprint, total);
  });

  const list = [...totals.values()];
  const seen = await readAll(
    list.map(({ fingerprint }) => `${ERR_SEEN_KEY_PREFIX}${KEY_SEPARATOR}${fingerprint}`),
  );
  list.forEach((total, index) => {
    total.isNew = seen[index] === null || seen[index] === undefined;
  });
  return list;
}

function digestText(day: string, flagged: readonly FingerprintTotal[], truncated: boolean): string {
  const sorted = [...flagged].sort((a, b) => b.count - a.count);
  const lines = sorted.slice(0, MAX_LISTED_FINGERPRINTS).map((total) => {
    const reason = total.isNew ? 'new' : `over ${OVER_THRESHOLD_COUNT}`;
    const releases = [...total.releases].sort().join(',');
    return `${total.fingerprint}  ${total.count}x  ${reason}  [${releases}]  ${total.message}`;
  });
  const hidden = sorted.length - lines.length;
  const more = hidden > 0 ? [`and ${hidden} more fingerprints`] : [];
  const partial = truncated
    ? [
        '',
        `The day index read stopped after ${MAX_INDEX_PAGES} pages, so this list and its counts are partial.`,
      ]
    : [];
  return [
    `Client error fingerprints for ${day} (UTC) that are new or reached ${OVER_THRESHOLD_COUNT} reports.`,
    '',
    ...lines,
    ...more,
    ...partial,
  ].join('\n');
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = requireCron(req);
  if (denied) return denied;

  const requestId = crypto.randomUUID();
  const day = utcDay(new Date(Date.now() - MS_PER_DAY));

  let totals: FingerprintTotal[];
  let truncated: boolean;
  try {
    const indexed = await readDayIndex(day);
    truncated = indexed.truncated;
    totals = await totalsByFingerprint(indexed.keys);
  } catch (readErr) {
    log.error('error-digest could not read the error records', { requestId, err: readErr });
    return err({
      requestId,
      status: HTTP_STATUS.serviceUnavailable,
      code: 'storage_unavailable',
      message: 'storage unavailable',
    });
  }

  const flagged = totals.filter((total) => total.isNew || total.count >= OVER_THRESHOLD_COUNT);
  const summary = {
    day,
    fingerprints: totals.length,
    flagged: flagged.length,
    mailed: false,
    truncated,
  };
  if (truncated) {
    log.warn('error-digest day index hit the page cap, skipping the seen markers', {
      requestId,
      day,
      maxPages: MAX_INDEX_PAGES,
    });
  }

  if (flagged.length > 0) {
    if (!env.RESEND_API_KEY) {
      log.error('error-digest: RESEND_API_KEY not set, skipping the digest mail', { requestId });
      return ok({ requestId, data: summary });
    }
    try {
      const { error: sendError } = await sendMail({
        from: ERROR_DIGEST_FROM,
        to: EMAIL_ADDRESS,
        subject: `[portfolio] ${flagged.length} client error fingerprints for ${day}`,
        text: digestText(day, flagged, truncated),
        idempotencyKey: `error-digest-${day}`,
        timeoutMs: MAIL_TIMEOUT_MS,
      });
      if (sendError) throw sendError;
      summary.mailed = true;
    } catch (mailErr) {
      log.error('error-digest mail failed', { requestId, err: mailErr });
      return err({
        requestId,
        status: HTTP_STATUS.badGateway,
        code: 'mail_failed',
        message: 'digest mail failed',
      });
    }
  }

  if (totals.length > 0 && !truncated) {
    try {
      const pipe = getRedis().pipeline();
      for (const { fingerprint } of totals) {
        pipe.set(`${ERR_SEEN_KEY_PREFIX}${KEY_SEPARATOR}${fingerprint}`, day, { ex: SEEN_TTL_S });
      }
      await pipe.exec();
    } catch (markErr) {
      log.error('error-digest could not mark fingerprints as seen', { requestId, err: markErr });
    }
  }

  log.info('error-digest completed', { requestId, ...summary });
  return ok({ requestId, data: summary });
}
