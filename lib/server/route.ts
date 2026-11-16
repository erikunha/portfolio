import 'server-only';

import type { NextRequest } from 'next/server';
import type { ZodTypeAny, z } from 'zod';

import type { SiteLocale } from '@/content/site-locale';
import { HTTP_STATUS } from '@/lib/http-status';
import { log } from '@/lib/log';
import type { ClientRateLimiter } from '@/lib/rate-limit';
import { isCrossSiteRequest } from '@/lib/server/fetch-metadata';
import { clientRateLimitKey, type RateLimitIdentifier } from '@/lib/server/rate-limit-key';
import { readBoundedBody } from '@/lib/server/read-body';
import { localeFromRequest } from '@/lib/server/request-locale';
import { REQUEST_ID_HEADER, RETRY_AFTER_HEADER, retryAfterSeconds } from '@/lib/stream-protocol';

type RateLimitFactory = () => ClientRateLimiter;

export interface HandlerContext<TBody> {
  body: TBody;
  ipHash: RateLimitIdentifier;
  requestId: string;
  req: NextRequest;
}

export interface DefineHandlerOpts<TSchema extends ZodTypeAny> {
  schema: TSchema;
  rateLimit: RateLimitFactory;
  maxBodyBytes: number;
  rateLimitErrorMessage?: string | Readonly<Record<SiteLocale, string>>;
  handler: (ctx: HandlerContext<z.infer<TSchema>>) => Promise<Response>;
}

export type ApiErrorCode =
  | 'rate_limited'
  | 'invalid_json'
  | 'invalid_body'
  | 'validation_failed'
  | 'forbidden_origin'
  | 'unauthorized'
  | 'storage_unavailable';

interface ApiError {
  code: ApiErrorCode | (string & {});
  message: string;
  issues?: unknown;
}

const REQUEST_EVENT_MESSAGE = 'api request';

type RequestOutcome = 'ok' | 'client_error' | 'server_error' | 'rate_limited';

export interface RequestEventState {
  requestId: string;
  rateLimited: boolean;
}

function requestOutcome(status: number, rateLimited: boolean): RequestOutcome {
  if (rateLimited) return 'rate_limited';
  if (status >= HTTP_STATUS.internalServerError) return 'server_error';
  if (status >= HTTP_STATUS.badRequest) return 'client_error';
  return 'ok';
}

function emitRequestEvent(
  req: Request,
  state: RequestEventState,
  status: number,
  startedAt: number,
): void {
  try {
    log.info(REQUEST_EVENT_MESSAGE, {
      route: new URL(req.url).pathname,
      status,
      durationMs: Math.round(performance.now() - startedAt),
      outcome: requestOutcome(status, state.rateLimited),
      requestId: state.requestId,
      rateLimited: state.rateLimited,
    });
  } catch {
    console.error('[request-event] logger unavailable');
  }
}

export async function withRequestEvent(
  req: Request,
  state: RequestEventState,
  run: () => Promise<Response>,
): Promise<Response> {
  const startedAt = performance.now();
  let status: number = HTTP_STATUS.internalServerError;
  try {
    const res = await run();
    status = res.status;
    return res;
  } finally {
    emitRequestEvent(req, state, status, startedAt);
  }
}

export function ok<T>(opts: { requestId: string; data?: T; status?: number }): Response {
  const body: { ok: true; requestId: string; data?: T } = {
    ok: true,
    requestId: opts.requestId,
  };
  if (opts.data !== undefined) body.data = opts.data;
  return Response.json(body, {
    status: opts.status ?? HTTP_STATUS.ok,
    headers: { [REQUEST_ID_HEADER]: opts.requestId },
  });
}

export function err(opts: {
  requestId: string;
  status: number;
  code: ApiErrorCode | (string & {});
  message: string;
  issues?: unknown;
  extraHeaders?: Record<string, string>;
}): Response {
  const error: ApiError = { code: opts.code, message: opts.message };
  if (opts.issues !== undefined) error.issues = opts.issues;
  return Response.json(
    { ok: false, requestId: opts.requestId, error },
    {
      status: opts.status,
      headers: { [REQUEST_ID_HEADER]: opts.requestId, ...(opts.extraHeaders ?? {}) },
    },
  );
}

function rateLimitMessage(
  message: DefineHandlerOpts<ZodTypeAny>['rateLimitErrorMessage'],
  req: Request,
): string {
  if (message === undefined) return 'too many requests';
  if (typeof message === 'string') return message;
  return message[localeFromRequest(req)];
}

export function defineHandler<TSchema extends ZodTypeAny>(
  opts: DefineHandlerOpts<TSchema>,
): (req: NextRequest) => Promise<Response> {
  return (req) => {
    const state: RequestEventState = { requestId: crypto.randomUUID(), rateLimited: false };
    return withRequestEvent(req, state, () => handle(opts, req, state));
  };
}

async function handle<TSchema extends ZodTypeAny>(
  opts: DefineHandlerOpts<TSchema>,
  req: NextRequest,
  state: RequestEventState,
): Promise<Response> {
  const { requestId } = state;
  if (isCrossSiteRequest(req)) {
    return err({
      requestId,
      status: HTTP_STATUS.forbidden,
      code: 'forbidden_origin',
      message: 'cross-site requests are not accepted',
    });
  }
  let ipHash: RateLimitIdentifier;
  try {
    ipHash = await clientRateLimitKey(req);
  } catch (hashErr) {
    log.error('ip hash unavailable', { requestId, err: hashErr });
    return err({
      requestId,
      status: HTTP_STATUS.serviceUnavailable,
      code: 'storage_unavailable',
      message: 'storage unavailable',
    });
  }

  let rateLimitAllowed = true;
  let rateLimitReset: unknown;
  try {
    const { success, reset } = await opts.rateLimit().limit(ipHash);
    rateLimitAllowed = success;
    rateLimitReset = reset;
  } catch (rateLimitErr) {
    log.warn('rate-limit unavailable, allowing request', { requestId, err: rateLimitErr });
  }
  if (!rateLimitAllowed) {
    state.rateLimited = true;
    const retryAfter = retryAfterSeconds(rateLimitReset, Date.now());
    return err({
      requestId,
      status: HTTP_STATUS.tooManyRequests,
      code: 'rate_limited',
      message: rateLimitMessage(opts.rateLimitErrorMessage, req),
      ...(retryAfter === null
        ? {}
        : { extraHeaders: { [RETRY_AFTER_HEADER]: String(retryAfter) } }),
    });
  }

  const bounded = await readBoundedBody(req, opts.maxBodyBytes);
  if (!bounded.ok) {
    return err({
      requestId,
      status: bounded.status,
      code: bounded.code,
      message: bounded.message,
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bounded.bytes ?? new Uint8Array()));
  } catch {
    return err({
      requestId,
      status: HTTP_STATUS.badRequest,
      code: 'invalid_json',
      message: 'invalid request body',
    });
  }

  const parsed = opts.schema.safeParse(raw);
  if (!parsed.success) {
    return err({
      requestId,
      status: HTTP_STATUS.badRequest,
      code: 'validation_failed',
      message: 'request validation failed',
      issues: parsed.error.issues,
    });
  }

  return opts.handler({ body: parsed.data, ipHash, requestId, req });
}
