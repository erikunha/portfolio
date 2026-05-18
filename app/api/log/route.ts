// app/api/log/route.ts
// Custom client-error capture endpoint. Accepts structured error reports
// from the browser bridge (lib/error-bridge.ts) + ErrorBoundary.client.tsx
// and persists them to Upstash KV with 30-day TTL for retrospective triage.
//
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §7a

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/log';
import { getClientIp, getErrorLogLimit, getRedis } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const ERR_KV_TTL_S = 30 * 24 * 60 * 60; // 30 days = 2_592_000s

const ErrorPayload = z.object({
  level: z.enum(['error', 'warn']),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  ts: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const ip = getClientIp(req);

  // Rate-limit BEFORE the KV write to absorb storms cheaply.
  const { success } = await getErrorLogLimit().limit(ip);
  if (!success) {
    return Response.json({ error: 'too many error reports' }, { status: 429 });
  }

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

  // Hash IP with SHA-256 + DEPLOY_SALT, same pattern as /api/contact.
  const ipBytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip + (process.env.DEPLOY_SALT ?? 'portfolio')),
  );
  const ipHash = Buffer.from(ipBytes).toString('hex').slice(0, 16);

  const errId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const key = `err:${today}:${errId}`;

  const record = {
    ...parsed.data,
    requestId,
    errId,
    ipHash,
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
