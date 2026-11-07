import { askErrors } from '@/content/ask-errors';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { isInjectionAttempt } from '@/lib/ask/injection';
import { ASK_MAX_OUTPUT_TOKENS, ASK_MAX_QUESTION_CHARS } from '@/lib/ask/limits';
import { type AskRefusalStatus, countAskRefusal } from '@/lib/ask/refusal-count';
import { PROMPT_VERSION } from '@/lib/ask/system-prompt';
import { env } from '@/lib/env';
import { hashIp } from '@/lib/ip-hash';
import { log } from '@/lib/log';
import { describeError } from '@/lib/log-error';
import {
  checkIdenticalQuestion,
  getAskLimit,
  getClientIp,
  hasRedisCredentials,
  reserveBudget,
} from '@/lib/rate-limit';
import { afterResponse } from '@/lib/server/after-response';
import { isCrossSiteRequest } from '@/lib/server/fetch-metadata';
import { readBoundedBody } from '@/lib/server/read-body';
import { err } from '@/lib/server/route';
import {
  ASK_LOCALE_HEADER,
  REQUEST_ID_HEADER,
  RETRY_AFTER_HEADER,
  retryAfterSeconds,
} from '@/lib/stream-protocol';

const OFF_KEYWORDS = new Set(['false', '0', 'off', 'no', 'disabled']);

const MAX_ASK_BODY_BYTES = 8_192;

const UNHASHED_IP_LABEL = 'unhashed';

export type AskContext = {
  requestId: string;
  ipHash: string;
  startedAt: number;
  question: string;
  answerLocale: SiteLocale;
  reserved: number;
  budgetKey: string;
  dailyKey: string;
};

export type PreflightResult = { ok: false; response: Response } | { ok: true; context: AskContext };

export function siteLocaleOf(value: unknown): SiteLocale | null {
  return value === SITE_LOCALE.pt || value === SITE_LOCALE.en ? value : null;
}

export function askError(
  requestId: string,
  error: string,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error },
    { status, headers: { [REQUEST_ID_HEADER]: requestId, ...headers } },
  );
}

function reject(response: Response): PreflightResult {
  return { ok: false, response };
}

async function checkRateLimit(
  ip: string,
): Promise<{ limited: boolean; retryAfter: number | null }> {
  try {
    const { success, reset } = await getAskLimit().limit(ip);
    if (success) return { limited: false, retryAfter: null };
    return { limited: true, retryAfter: retryAfterSeconds(reset, Date.now()) };
  } catch (limitErr) {
    if (hasRedisCredentials()) {
      log.error('ask rate-limit check failed, allowing through', {
        error: describeError(limitErr),
      });
    }
    return { limited: false, retryAfter: null };
  }
}

type ParsedQuestion =
  | { ok: true; question: string; answerLocale: SiteLocale }
  | { ok: false; reason: 'question required' | 'invalid body' };

function parseQuestion(
  bytes: Uint8Array | null | undefined,
  pageLocale: SiteLocale,
): ParsedQuestion {
  try {
    const rawBody: unknown = JSON.parse(new TextDecoder().decode(bytes ?? new Uint8Array()));
    const body =
      typeof rawBody === 'object' && rawBody !== null && !Array.isArray(rawBody)
        ? (rawBody as Record<string, unknown>)
        : {};
    const q = body.question;
    if (typeof q !== 'string' || !q.trim()) return { ok: false, reason: 'question required' };
    return {
      ok: true,
      question: q.trim().slice(0, ASK_MAX_QUESTION_CHARS),
      answerLocale: siteLocaleOf(body.locale) ?? pageLocale,
    };
  } catch {
    return { ok: false, reason: 'invalid body' };
  }
}

export async function preflightAsk(req: Request): Promise<PreflightResult> {
  const pageLocale = siteLocaleOf(req.headers.get(ASK_LOCALE_HEADER)) ?? SITE_LOCALE.en;
  const requestId = crypto.randomUUID();
  const askFlag = (env.ASK_ENABLED ?? '').trim().toLowerCase();
  if (OFF_KEYWORDS.has(askFlag)) {
    return reject(askError(requestId, askErrors[pageLocale].unavailable, 503));
  }
  if (isCrossSiteRequest(req)) {
    return reject(askError(requestId, askErrors[pageLocale].forbiddenOrigin, 403));
  }

  const startedAt = Date.now();
  const ip = getClientIp(req);
  const ipHash = await hashIp(ip).catch((hashErr: unknown) => {
    log.error('ask ip hash unavailable, continuing unhashed', {
      requestId,
      error: describeError(hashErr),
    });
    return UNHASHED_IP_LABEL;
  });
  log.info('ask request received', { requestId, ipHash, promptVersion: PROMPT_VERSION });

  const recordRefusal = (status: AskRefusalStatus): void => {
    log.info('ask refused', { requestId, ipHash, status });
    afterResponse(() => countAskRefusal(status));
  };

  const { limited, retryAfter } = await checkRateLimit(ip);
  if (limited) {
    recordRefusal('rate-limited');
    return reject(
      askError(
        requestId,
        askErrors[pageLocale].rateLimited,
        429,
        retryAfter === null ? {} : { [RETRY_AFTER_HEADER]: String(retryAfter) },
      ),
    );
  }

  const bounded = await readBoundedBody(req, MAX_ASK_BODY_BYTES);
  if (!bounded.ok) {
    return reject(
      err({
        requestId,
        status: bounded.status,
        code: bounded.code,
        message: bounded.message,
      }),
    );
  }

  const parsed = parseQuestion(bounded.bytes, pageLocale);
  if (!parsed.ok) {
    log.info(`ask rejected: ${parsed.reason}`, { requestId, ipHash });
    const message =
      parsed.reason === 'question required'
        ? askErrors[pageLocale].questionRequired
        : askErrors[pageLocale].invalidBody;
    return reject(askError(requestId, message, 400));
  }
  const { question, answerLocale } = parsed;

  if (isInjectionAttempt(question)) {
    log.info('ask rejected: prompt-injection pattern', { requestId, ipHash });
    return reject(askError(requestId, askErrors[answerLocale].injection, 400));
  }

  const { allowed: notDuplicate } = await checkIdenticalQuestion(ipHash, question);
  if (!notDuplicate) {
    recordRefusal('dedup-rejected');
    return reject(askError(requestId, askErrors[answerLocale].duplicate, 429));
  }

  const { allowed, reserved, budgetKey, dailyKey } = await reserveBudget(ASK_MAX_OUTPUT_TOKENS);
  if (!allowed) {
    recordRefusal('budget-exhausted');
    return reject(askError(requestId, askErrors[answerLocale].budget, 503));
  }

  return {
    ok: true,
    context: {
      requestId,
      ipHash,
      startedAt,
      question,
      answerLocale,
      reserved,
      budgetKey,
      dailyKey,
    },
  };
}
