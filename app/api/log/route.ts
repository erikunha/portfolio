// app/api/log/route.ts
// Custom client-error capture endpoint. Accepts structured error reports
// from the browser bridge (lib/error-bridge.ts) + ErrorBoundary.client.tsx
// and persists them to Upstash KV with 30-day TTL for retrospective triage.
//
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §7a
//
// Privacy: err:* records do NOT store ipHash. The IP is used only for
// rate-limiting and discarded. err:* records are therefore personal-data-free
// and fall outside the /api/log/forget erasure scope (which covers
// ask:log:* only). See DECISIONS.md 2026-05-19.

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/log';
import { getClientIp, getErrorLogLimit, getRedis } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Smoke-test sentinel: messages prefixed '[smoke]' pass validation and
// rate-limiting but are NOT written to KV. Prevents CI smoke runs from
// polluting the err:{date}:* partition and skewing error-rate analysis.
// Anyone sending a '[smoke]'-prefixed real error only self-suppresses;
// no adverse effect on other clients. See tests/e2e/observability-smoke.spec.ts.
const SMOKE_PREFIX = '[smoke]';

const ERR_KV_TTL_S = 30 * 24 * 60 * 60; // 30 days = 2_592_000s

const ErrorPayload = z.object({
  level: z.enum(['error', 'warn']),
  message: z.string().min(1).max(2000),
  stack: z.string().max(16000).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  ts: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  // Parse + validate first (local, cheap). Smoke bypass runs BEFORE the
  // rate-limit + KV calls so smoke testing doesn't require Upstash to be
  // configured — important for CI environments without prod secrets.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = ErrorPayload.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid payload shape', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Smoke-test sentinel: messages prefixed '[smoke]' bypass rate-limit AND
  // KV persistence. Anyone sending a '[smoke]'-prefixed real error only
  // self-suppresses; no adverse effect on other clients.
  if (parsed.data.message.startsWith(SMOKE_PREFIX)) {
    return new Response(null, { status: 204 });
  }

  // Rate-limit BEFORE the KV write to absorb storms cheaply.
  const ip = getClientIp(req);
  const { success } = await getErrorLogLimit().limit(ip);
  if (!success) {
    return Response.json(
      { error: 'too many error reports' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const errId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const key = `err:${today}:${errId}`;

  // ipHash intentionally omitted: err:* records must contain no personal data
  // so that /api/log/forget (which targets ask:log:* only) covers the full
  // erasure scope without needing to handle err:* records separately.
  const record = {
    ...parsed.data,
    errId,
    capturedAt: new Date().toISOString(),
  };

  try {
    await getRedis().set(key, JSON.stringify(record), { ex: ERR_KV_TTL_S });
  } catch (kvErr) {
    log.error('error-log KV write failed', { requestId, errId, err: kvErr });
    return Response.json({ error: 'storage unavailable' }, { status: 503 });
  }

  return new Response(null, { status: 204 });
}
