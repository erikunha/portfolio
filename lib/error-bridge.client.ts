'use client';

const DEDUP_TAIL_MS = 100;
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
  if (recentEmissions.size >= MAX_DEDUP_SIZE) {
    const oldest = recentEmissions.keys().next().value;
    if (oldest !== undefined) recentEmissions.delete(oldest);
  }
  recentEmissions.set(key, now);
  for (const [k, ts] of recentEmissions) {
    if (now - ts > DEDUP_TAIL_MS) recentEmissions.delete(k);
  }
  return true;
}

function send(payload: Payload): void {
  void fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
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
