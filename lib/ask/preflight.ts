import { type AskErrors, askErrors } from '@/content/ask-errors';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { type BudgetRefusalReason, reserveBudget } from '@/lib/ask/budget';
import { parseConversationId } from '@/lib/ask/conversation-id';
import { checkIdenticalQuestion, releaseIdenticalQuestion } from '@/lib/ask/dedup';
import { isInjectionAttempt } from '@/lib/ask/injection';
import { ASK_MAX_OUTPUT_TOKENS, ASK_MAX_QUESTION_CHARS } from '@/lib/ask/limits';
import { type AskRefusalStatus, countAskRefusal } from '@/lib/ask/refusal-count';
import { PROMPT_VERSION } from '@/lib/ask/system-prompt';
import { env } from '@/lib/env';
import { HTTP_STATUS } from '@/lib/http-status';
import { log } from '@/lib/log';
import { describeError } from '@/lib/log-error';
import { getAskLimit } from '@/lib/rate-limit';
import { hasRedisCredentials } from '@/lib/redis';
import { afterResponse } from '@/lib/server/after-response';
import { isCrossSiteRequest } from '@/lib/server/fetch-metadata';
import { clientRateLimitKey, type RateLimitIdentifier } from '@/lib/server/rate-limit-key';
import { readBoundedBody } from '@/lib/server/read-body';
import { localeFromRequest } from '@/lib/server/request-locale';
import { err } from '@/lib/server/route';
import { REQUEST_ID_HEADER, RETRY_AFTER_HEADER, retryAfterSeconds } from '@/lib/stream-protocol';

const OFF_KEYWORDS = new Set(['false', '0', 'off', 'no', 'disabled']);

const MAX_ASK_BODY_BYTES = 8_192;

const UNHASHED_IP_LABEL = 'unhashed';

const BUDGET_REFUSALS: Record<
  BudgetRefusalReason,
  { status: AskRefusalStatus; message: keyof AskErrors }
> = {
  month: { status: 'budget-exhausted', message: 'budget' },
  day: { status: 'budget-exhausted', message: 'budgetDaily' },
  store: { status: 'budget-store-unavailable', message: 'unavailable' },
};

export type AskContext = {
  requestId: string;
  ipHash: string;
  startedAt: number;
  question: string;
  fullQuestion: string;
  answerLocale: SiteLocale;
  conversationId?: string;
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

const NOT_LIMITED = { limited: false, retryAfter: null } as const;

async function checkRateLimit(
  identifier: RateLimitIdentifier | null,
): Promise<{ limited: boolean; retryAfter: number | null }> {
  if (identifier === null) return NOT_LIMITED;
  try {
    const { success, reset } = await getAskLimit().limit(identifier);
    if (success) return NOT_LIMITED;
    return { limited: true, retryAfter: retryAfterSeconds(reset, Date.now()) };
  } catch (limitErr) {
    if (hasRedisCredentials()) {
      log.error('ask rate-limit check failed, allowing through', {
        error: describeError(limitErr),
      });
    }
    return NOT_LIMITED;
  }
}

type ParsedQuestion =
  | {
      ok: true;
      question: string;
      fullQuestion: string;
      answerLocale: SiteLocale;
      conversationId: string | null;
    }
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
    const conversationId =
      body.conversationId === undefined ? null : parseConversationId(body.conversationId);
    if (body.conversationId !== undefined && conversationId === null) {
      return { ok: false, reason: 'invalid body' };
    }
    const fullQuestion = q.trim();
    return {
      ok: true,
      question: fullQuestion.slice(0, ASK_MAX_QUESTION_CHARS),
      fullQuestion,
      answerLocale: siteLocaleOf(body.locale) ?? pageLocale,
      conversationId,
    };
  } catch {
    return { ok: false, reason: 'invalid body' };
  }
}

export async function preflightAsk(req: Request): Promise<PreflightResult> {
  const pageLocale = localeFromRequest(req);
  const requestId = crypto.randomUUID();
  const askFlag = (env.ASK_ENABLED ?? '').trim().toLowerCase();
  if (OFF_KEYWORDS.has(askFlag)) {
    return reject(
      askError(requestId, askErrors[pageLocale].unavailable, HTTP_STATUS.serviceUnavailable),
    );
  }
  if (isCrossSiteRequest(req)) {
    return reject(
      askError(requestId, askErrors[pageLocale].forbiddenOrigin, HTTP_STATUS.forbidden),
    );
  }

  const startedAt = Date.now();
  const rateLimitKey = await clientRateLimitKey(req).catch((hashErr: unknown) => {
    log.error('ask ip hash unavailable, continuing unhashed', {
      requestId,
      error: describeError(hashErr),
    });
    return null;
  });
  const ipHash = rateLimitKey ?? UNHASHED_IP_LABEL;
  log.info('ask request received', { requestId, ipHash, promptVersion: PROMPT_VERSION });

  const recordRefusal = (status: AskRefusalStatus): void => {
    log.info('ask refused', { requestId, ipHash, status });
    afterResponse(() => countAskRefusal(status));
  };

  const { limited, retryAfter } = await checkRateLimit(rateLimitKey);
  if (limited) {
    recordRefusal('rate-limited');
    return reject(
      askError(
        requestId,
        askErrors[pageLocale].rateLimited,
        HTTP_STATUS.tooManyRequests,
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
    return reject(askError(requestId, message, HTTP_STATUS.badRequest));
  }
  const { question, fullQuestion, answerLocale, conversationId } = parsed;

  if (isInjectionAttempt(question)) {
    log.info('ask rejected: prompt-injection pattern', { requestId, ipHash });
    return reject(askError(requestId, askErrors[answerLocale].injection, HTTP_STATUS.badRequest));
  }

  const { allowed: notDuplicate } = await checkIdenticalQuestion(rateLimitKey, question);
  if (!notDuplicate) {
    recordRefusal('dedup-rejected');
    return reject(
      askError(requestId, askErrors[answerLocale].duplicate, HTTP_STATUS.tooManyRequests),
    );
  }

  const reservation = await reserveBudget(ASK_MAX_OUTPUT_TOKENS);
  if (!reservation.allowed) {
    const refusal = BUDGET_REFUSALS[reservation.reason];
    recordRefusal(refusal.status);
    await releaseIdenticalQuestion(rateLimitKey, question);
    return reject(
      askError(requestId, askErrors[answerLocale][refusal.message], HTTP_STATUS.serviceUnavailable),
    );
  }
  const { reserved, budgetKey, dailyKey } = reservation;

  return {
    ok: true,
    context: {
      requestId,
      ipHash,
      startedAt,
      question,
      fullQuestion,
      answerLocale,
      ...(conversationId === null ? {} : { conversationId }),
      reserved,
      budgetKey,
      dailyKey,
    },
  };
}
