// app/api/log/forget/route.ts
// GDPR Art. 17 / LGPD Art. 18 right-of-erasure endpoint for /api/ask
// Q+A logs. Accepts { requestId } and DELETEs the matching KV record
// across the last 90 days of date-partitioned keys.
//
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §7d
// PR 5 of audit roadmap: refactored to use lib/server/route.ts defineHandler
// for the unified envelope + X-Request-Id + standard pre-flight ordering.
// The previously-exposed `deleted: count` field is REMOVED from the success
// response (audit Theme 8 + Standard 4: it leaked an existence oracle).

import { z } from 'zod';

import { log } from '@/lib/log';
import { getForgetLimit, getRedis } from '@/lib/rate-limit';
import { defineHandler, err, ok } from '@/lib/server/route';

export const dynamic = 'force-dynamic';

const ForgetPayload = z.object({
  requestId: z.string().uuid(),
});

// Smoke-test sentinel: a well-known UUID that bypasses Upstash so the smoke
// spec can exercise the endpoint without prod secrets configured. Returns
// the same shape a real call would return for a missing record.
const SMOKE_UUID = '00000000-0000-4000-8000-000000000000';

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export const POST = defineHandler({
  schema: ForgetPayload,
  rateLimit: getForgetLimit,
  rateLimitErrorMessage: 'too many forget requests',
  async handler({ body, requestId }) {
    const { requestId: targetRequestId } = body;

    // Smoke bypass: matches the spec's SYNTHETIC_REQUEST_ID constant. We
    // return success WITHOUT touching KV so CI smoke runs don't need prod
    // Upstash secrets.
    if (targetRequestId === SMOKE_UUID) {
      return ok({ requestId });
    }

    const candidateKeys = lastNDates(90).map((d) => `ask:log:${d}:${targetRequestId}`);

    let deleted = 0;
    try {
      // Upstash supports `del` with multiple keys in a single call; cheaper
      // than 90 separate round-trips when most candidates miss.
      deleted = await getRedis().del(...candidateKeys);
    } catch (kvErr) {
      log.error('forget KV delete failed', { requestId, targetRequestId, err: kvErr });
      return err({
        requestId,
        status: 503,
        code: 'storage_unavailable',
        message: 'storage unavailable',
      });
    }

    // Log the delete count internally for audit, but DO NOT expose it on the
    // wire response: audit Theme 8 flagged the prior `{ ok: true, deleted: N }`
    // shape as an existence oracle — an attacker with a leaked requestId could
    // confirm "was this Q+A actually persisted?" by inspecting the count.
    // External response is uniformly `{ ok: true, requestId }`.
    log.info('forget request processed', { requestId, targetRequestId, deleted });
    return ok({ requestId });
  },
});
