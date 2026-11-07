import 'server-only';

import type { NextRequest } from 'next/server';
import type { ZodTypeAny, z } from 'zod';

import { DEFAULT_SITE_LOCALE, SITE_LOCALES, type SiteLocale } from '@/content/site-locale';
import { hashIp } from '@/lib/ip-hash';
import { log } from '@/lib/log';
import { getClientIp } from '@/lib/rate-limit';
import { isCrossSiteRequest } from '@/lib/server/fetch-metadata';
import { readBoundedBody } from '@/lib/server/read-body';
import { ASK_LOCALE_HEADER, RETRY_AFTER_HEADER, retryAfterSeconds } from '@/lib/stream-protocol';

interface RateLimit {
  limit(ip: string): Promise<{ success: boolean; reset?: number }>;
}
type RateLimitFactory = () => RateLimit;

export interface HandlerContext<TBody> {
  body: TBody;
  ip: string;
  ipHash: string;
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

const HTTP_STATUS = { forbidden: 403, storageUnavailable: 503 } as const;

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

export function ok<T>(opts: { requestId: string; data?: T; status?: number }): Response {
  const body: { ok: true; requestId: string; data?: T } = {
    ok: true,
    requestId: opts.requestId,
  };
  if (opts.data !== undefined) body.data = opts.data;
  return Response.json(body, {
    status: opts.status ?? 200,
    headers: { 'X-Request-Id': opts.requestId },
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
      headers: { 'X-Request-Id': opts.requestId, ...(opts.extraHeaders ?? {}) },
    },
  );
}

function rateLimitMessage(
  message: DefineHandlerOpts<ZodTypeAny>['rateLimitErrorMessage'],
  req: Request,
): string {
  if (message === undefined) return 'too many requests';
  if (typeof message === 'string') return message;
  const header = req.headers.get(ASK_LOCALE_HEADER);
  return message[SITE_LOCALES.find((locale) => locale === header) ?? DEFAULT_SITE_LOCALE];
}

export function defineHandler<TSchema extends ZodTypeAny>(
  opts: DefineHandlerOpts<TSchema>,
): (req: NextRequest) => Promise<Response> {
  return async (req) => {
    const requestId = crypto.randomUUID();
    if (isCrossSiteRequest(req)) {
      return err({
        requestId,
        status: HTTP_STATUS.forbidden,
        code: 'forbidden_origin',
        message: 'cross-site requests are not accepted',
      });
    }
    const ip = getClientIp(req);

    let rateLimitAllowed = true;
    let rateLimitReset: unknown;
    try {
      const { success, reset } = await opts.rateLimit().limit(ip);
      rateLimitAllowed = success;
      rateLimitReset = reset;
    } catch (rateLimitErr) {
      log.warn('rate-limit unavailable, allowing request', { requestId, err: rateLimitErr });
    }
    if (!rateLimitAllowed) {
      const retryAfter = retryAfterSeconds(rateLimitReset, Date.now());
      return err({
        requestId,
        status: 429,
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
      return err({ requestId, status: 400, code: 'invalid_json', message: 'invalid request body' });
    }

    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) {
      return err({
        requestId,
        status: 400,
        code: 'validation_failed',
        message: 'request validation failed',
        issues: parsed.error.issues,
      });
    }

    let ipHash: string;
    try {
      ipHash = await hashIp(ip);
    } catch (hashErr) {
      log.error('ip hash unavailable', { requestId, err: hashErr });
      return err({
        requestId,
        status: HTTP_STATUS.storageUnavailable,
        code: 'storage_unavailable',
        message: 'storage unavailable',
      });
    }

    return opts.handler({ body: parsed.data, ip, ipHash, requestId, req });
  };
}
