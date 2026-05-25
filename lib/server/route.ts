// lib/server/route.ts
//
// Small, bounded route-handler primitive for the JSON-shaped /api/* surface.
// Extracts the four cross-cutting concerns every JSON route was hand-rolling:
//
//   1. Mint a requestId per call.
//   2. Per-IP rate limit (fail-open on Redis outage, logged).
//   3. Parse JSON body + validate via Zod.
//   4. Emit responses through one standardized envelope so the client can
//      tell success from error without per-route shape switches.
//
// Standardized envelope:
//   - Success: { ok: true, requestId, data?: T }
//   - Error:   { ok: false, requestId, error: { code, message, issues? } }
//
// Every response carries `X-Request-Id` header for cross-surface correlation.
//
// Scope is deliberately small: defineHandler owns rate-limit → parse →
// validate → envelope. Routes own everything else (KV writes, side effects,
// business logic). Streaming routes (/api/ask) are intentionally NOT
// refactored to this helper — their response shape is intrinsically
// different and the abstraction wouldn't earn its keep.

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

/** Per-request handler context. Body is the Zod-validated payload. */
export interface HandlerContext<TBody> {
  body: TBody;
  ip: string;
  ipHash: string;
  requestId: string;
  req: NextRequest;
}

export interface DefineHandlerOpts<TSchema extends ZodTypeAny> {
  /** Zod schema applied to the JSON body. Validated before the handler runs. */
  schema: TSchema;
  /** Rate-limit factory (lazy-instantiated Upstash Ratelimit per route). */
  rateLimit: RateLimitFactory;
  /** Optional override for the 429 response message. */
  rateLimitErrorMessage?: string;
  /** The route's actual logic. Receives validated body + helpers. */
  handler: (ctx: HandlerContext<z.infer<TSchema>>) => Promise<Response>;
}

interface ApiError {
  code: string;
  message: string;
  issues?: unknown;
}

/**
 * Success envelope. `data` is omitted when undefined to keep the wire shape
 * tight. `X-Request-Id` is always emitted so clients can correlate logs.
 */
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

/**
 * Error envelope. `code` is a stable machine-readable identifier (e.g.
 * `validation_failed`, `rate_limited`, `storage_unavailable`). `message` is
 * the user-facing string. `issues` carries Zod issues array when relevant —
 * useful for client-side form rendering.
 */
export function err(opts: {
  requestId: string;
  status: number;
  code: string;
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

/**
 * Wraps a handler with the standard pre-flight: rate-limit → parse → validate
 * → handle. Returns a Next.js-shaped (req) => Promise<Response> function ready
 * to export from a route module.
 */
export function defineHandler<TSchema extends ZodTypeAny>(
  opts: DefineHandlerOpts<TSchema>,
): (req: NextRequest) => Promise<Response> {
  return async (req) => {
    const requestId = crypto.randomUUID();
    const ip = getClientIp(req);

    // Rate limit BEFORE body parse (Audit Standard 3 ordering). Fail-open on
    // Redis outage matches the existing /api/ask budget-counter pattern; the
    // operational backstop is the Anthropic + Upstash spend alerts, not the
    // in-app counter. Failure is logged with the requestId so a degraded
    // window can be reconstructed from runtime logs.
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

    // Parse JSON body.
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return err({ requestId, status: 400, code: 'invalid_json', message: 'invalid request body' });
    }

    // Validate via Zod. `safeParse` is preferred over `parse` so we can shape
    // a structured error envelope without try/catch noise around the call site.
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

    // Hash the IP only after the request has earned its way past rate-limit
    // and validation. Saves a SHA-256 + Upstash KV round-trip on every
    // rejected request.
    const ipHash = await hashIp(ip);

    return opts.handler({ body: parsed.data, ip, ipHash, requestId, req });
  };
}
