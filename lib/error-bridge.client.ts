'use client';

// lib/error-bridge.ts
// Browser-side bridge that captures unhandled errors and promise
// rejections and POSTs them to /api/log. Deduplicates within a 100ms
// tail window keyed on (message, stack) to absorb React's error replay
// (which can fire the same error 2-3 times in <50ms during reconciliation)
// without suppressing meaningful repeat-occurrence signal later in the
// session.
//
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §7b

const DEDUP_TAIL_MS = 100;
// Backstop against unbounded Map growth when each error message contains a
// unique ID or timestamp (tight loops faster than the 100ms window can drain).
// FIFO eviction: oldest entry deleted before inserting when cap is hit.
export const MAX_DEDUP_SIZE = 100;
const recentEmissions = new Map<string, number>();

type Payload = {
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  ts: string;
};

export type LogPayload = Payload;

export function buildLogPayload(message: string, stack: string | undefined): LogPayload {
  return {
    level: 'error',
    message,
    ...(stack !== undefined && { stack }),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
    ts: new Date().toISOString(),
  };
}

function buildKey(message: string, stack: string | undefined): string {
  return `${message}|${stack ?? ''}`;
}

function shouldEmit(key: string): boolean {
  const now = Date.now();
  const last = recentEmissions.get(key);
  if (last !== undefined && now - last < DEDUP_TAIL_MS) return false;
  // Evict the oldest entry (FIFO) when the Map hits the size cap. Map
  // iteration order is insertion order, so .keys().next() is always oldest.
  if (recentEmissions.size >= MAX_DEDUP_SIZE) {
    const oldest = recentEmissions.keys().next().value;
    if (oldest !== undefined) recentEmissions.delete(oldest);
  }
  recentEmissions.set(key, now);
  // Opportunistic cleanup: drop stale entries every emit to avoid memory growth.
  for (const [k, ts] of recentEmissions) {
    if (now - ts > DEDUP_TAIL_MS) recentEmissions.delete(k);
  }
  return true;
}

function send(payload: Payload): void {
  // Fire-and-forget; failures swallowed (we cannot recursively report
  // an error from the error-reporting bridge).
  void fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // keepalive lets the request finish even if the page is unloading.
    // Browser caps total keepalive body size at 64KB per origin; the /api/log
    // Zod schema (Task 4) limits stack to 16KB which keeps us well under that
    // ceiling for any reasonable payload.
    keepalive: true,
  }).catch(() => {
    // Intentional no-op.
  });
}

function handleError(event: ErrorEvent): void {
  const message = event.message ?? 'unknown error';
  const stack = event.error instanceof Error ? event.error.stack : undefined;
  if (!shouldEmit(buildKey(message, stack))) return;
  send(buildLogPayload(message, stack));
}

function handleRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'unhandled promise rejection';
  const stack = reason instanceof Error ? reason.stack : undefined;
  if (!shouldEmit(buildKey(message, stack))) return;
  send(buildLogPayload(message, stack));
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
}
