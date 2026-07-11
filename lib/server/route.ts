import 'server-only';

import type { NextRequest } from 'next/server';
import type { ZodTypeAny, z } from 'zod';

import { hashIp } from '@/lib/ip-hash';
import { log } from '@/lib/log';
import { getClientIp } from '@/lib/rate-limit';

interface RateLimit {
  limit(ip: string): Promise<{ success: boolean }>;
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
  rateLimitErrorMessage?: string;
  handler: (ctx: HandlerContext<z.infer<TSchema>>) => Promise<Response>;
}

export type ApiErrorCode =
  | 'rate_limited'
  | 'invalid_json'
  | 'validation_failed'
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

export function defineHandler<TSchema extends ZodTypeAny>(
  opts: DefineHandlerOpts<TSchema>,
): (req: NextRequest) => Promise<Response> {
  return async (req) => {
    const requestId = crypto.randomUUID();
    const ip = getClientIp(req);

    let rateLimitAllowed = true;
    try {
      const { success } = await opts.rateLimit().limit(ip);
      rateLimitAllowed = success;
    } catch (rateLimitErr) {
      log.warn('rate-limit unavailable, allowing request', { requestId, err: rateLimitErr });
    }
    if (!rateLimitAllowed) {
      return err({
        requestId,
        status: 429,
        code: 'rate_limited',
        message: opts.rateLimitErrorMessage ?? 'too many requests',
      });
    }

    let raw: unknown;
    try {
      raw = await req.json();
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

    const ipHash = await hashIp(ip);

    return opts.handler({ body: parsed.data, ip, ipHash, requestId, req });
  };
}
