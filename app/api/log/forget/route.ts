// app/api/log/forget/route.ts
// GDPR Art. 17 / LGPD Art. 18 right-of-erasure endpoint for /api/ask
// Q+A logs. Accepts { requestId } and DELETEs the matching KV record
// across the last 90 days of date-partitioned keys.
//
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §7d

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/log';
import { getClientIp, getForgetLimit, getRedis } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const ForgetPayload = z.object({
  requestId: z.string().uuid(),
});

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

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { success } = await getForgetLimit().limit(ip);
  if (!success) {
    return Response.json({ error: 'too many forget requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = ForgetPayload.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid payload shape', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { requestId } = parsed.data;
  const candidateKeys = lastNDates(90).map((d) => `ask:log:${d}:${requestId}`);

  let deleted = 0;
  try {
    const redis = getRedis();
    // Upstash supports del with multiple keys in a single call; cheaper than
    // 90 separate round-trips when most candidates miss.
    deleted = await redis.del(...candidateKeys);
  } catch (err) {
    log.error('forget KV delete failed', { requestId, err });
    return Response.json({ error: 'storage unavailable' }, { status: 503 });
  }

  log.info('forget request processed', { requestId, deleted });
  return Response.json({ ok: true, deleted });
}
