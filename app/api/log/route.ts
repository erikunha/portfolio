// app/api/log/route.ts
// Custom client-error capture endpoint. Accepts structured error reports
// from the browser bridge (lib/error-bridge.client.ts) + ErrorBoundary.client.tsx
// and persists them to Upstash KV with 30-day TTL for retrospective triage.
//
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §7a
// PR 5b of audit roadmap: refactored to use lib/server/route.ts defineHandler
// for the unified envelope + X-Request-Id + standard pre-flight ordering.
//
// Privacy: err:* records do NOT store ipHash. The IP is used only for
// rate-limiting and discarded. err:* records are therefore personal-data-free
// and fall outside the /api/log/forget erasure scope (which covers
// ask:log:* only). See DECISIONS.md 2026-05-19.

import { z } from 'zod';

import { log } from '@/lib/log';
import { getErrorLogLimit, getRedis } from '@/lib/rate-limit';
import { defineHandler, err, ok } from '@/lib/server/route';

export const dynamic = 'force-dynamic';

// Smoke-test sentinel: messages prefixed '[smoke]' pass validation and
// rate-limiting but are NOT written to KV. Prevents CI smoke runs from
// polluting the err:{date}:* partition and skewing error-rate analysis.
// Anyone sending a '[smoke]'-prefixed real error only self-suppresses;
// no adverse effect on other clients. The prefix match is case-insensitive
// so '[SMOKE]' / '[Smoke]' are treated identically.
// See tests/e2e/observability-smoke.spec.ts.
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

export const POST = defineHandler({
  schema: ErrorPayload,
  rateLimit: getErrorLogLimit,
  rateLimitErrorMessage: 'too many error reports',
  async handler({ body, requestId }) {
    // Smoke bypass: messages prefixed '[smoke]' return success WITHOUT
    // touching KV — prevents CI smoke runs from polluting the err: KV
    // partition. The rate-limit hit IS taken (one slot per smoke message
    // counts against the 10/min/IP quota); acceptable since CI smoke
    // posts <10 messages per run.
    if (body.message.toLowerCase().startsWith(SMOKE_PREFIX)) {
      return ok({ requestId });
    }

    const errId = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const key = `err:${today}:${errId}`;

    // ipHash intentionally omitted: err:* records must contain no personal data
    // so that /api/log/forget (which targets ask:log:* only) covers the full
    // erasure scope without needing to handle err:* records separately.
    const record = {
      ...body,
      errId,
      capturedAt: new Date().toISOString(),
    };

    try {
      await getRedis().set(key, JSON.stringify(record), { ex: ERR_KV_TTL_S });
    } catch (kvErr) {
      log.error('error-log KV write failed', { requestId, errId, err: kvErr });
      return err({
        requestId,
        status: 503,
        code: 'storage_unavailable',
        message: 'storage unavailable',
      });
    }

    return ok({ requestId });
  },
});
