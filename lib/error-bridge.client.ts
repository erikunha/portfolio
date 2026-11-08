'use client';

import { RETRY_AFTER_HEADER } from '@/lib/stream-protocol';
import { MS_PER_MINUTE, MS_PER_SECOND } from '@/lib/time';

const DEDUP_TAIL_MS = 100;
export const MAX_DEDUP_SIZE = 100;
export const MAX_REPORTS_PER_SESSION = 200;
export const BACKOFF_BASE_MS = 5 * MS_PER_SECOND;
export const BACKOFF_MAX_MS = 5 * MS_PER_MINUTE;

const BRIDGE_STATE_KEY = Symbol.for('erikunha.dev/error-bridge');

type BridgeState = {
  recentEmissions: Map<string, number>;
  listening: boolean;
  reported: number;
  failures: number;
  blockedUntil: number;
};

type BridgeWindow = Window & { [key: symbol]: BridgeState | undefined };

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
    url: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '',
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
    ts: new Date().toISOString(),
  };
}

function buildKey(message: string, stack: string | undefined): string {
  return `${message}|${stack ?? ''}`;
}

function getBridgeState(win: Window): BridgeState {
  const target = win as BridgeWindow;
  const existing = target[BRIDGE_STATE_KEY];
  if (existing) return existing;
  const created: BridgeState = {
    recentEmissions: new Map<string, number>(),
    listening: false,
    reported: 0,
    failures: 0,
    blockedUntil: 0,
  };
  target[BRIDGE_STATE_KEY] = created;
  return created;
}

function shouldEmit(state: BridgeState, key: string): boolean {
  const now = Date.now();
  const last = state.recentEmissions.get(key);
  if (last !== undefined && now - last < DEDUP_TAIL_MS) return false;
  if (state.recentEmissions.size >= MAX_DEDUP_SIZE) {
    const oldest = state.recentEmissions.keys().next().value;
    if (oldest !== undefined) state.recentEmissions.delete(oldest);
  }
  state.recentEmissions.set(key, now);
  for (const [k, ts] of state.recentEmissions) {
    if (now - ts > DEDUP_TAIL_MS) state.recentEmissions.delete(k);
  }
  return true;
}

function retryAfterMs(res: Response | undefined): number {
  const seconds = Number(res?.headers.get(RETRY_AFTER_HEADER));
  return Number.isFinite(seconds) ? seconds * MS_PER_SECOND : 0;
}

function penalize(state: BridgeState, res: Response | undefined): void {
  state.failures += 1;
  const wait = Math.min(BACKOFF_BASE_MS * 2 ** (state.failures - 1), BACKOFF_MAX_MS);
  state.blockedUntil = Date.now() + Math.max(wait, retryAfterMs(res));
}

export function postLog(payload: Payload): void {
  if (typeof window === 'undefined') return;
  const state = getBridgeState(window);
  if (state.reported >= MAX_REPORTS_PER_SESSION || Date.now() < state.blockedUntil) return;
  state.reported += 1;
  void fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then((res) => {
      if (res.ok) state.failures = 0;
      else penalize(state, res);
    })
    .catch(() => penalize(state, undefined));
}

function handleError(state: BridgeState, event: ErrorEvent): void {
  const message = event.message ?? 'unknown error';
  const stack = event.error instanceof Error ? event.error.stack : undefined;
  if (!shouldEmit(state, buildKey(message, stack))) return;
  postLog(buildLogPayload(message, stack));
}

function handleRejection(state: BridgeState, event: PromiseRejectionEvent): void {
  const reason = event.reason;
  const reasonText = typeof reason === 'string' ? reason : 'unhandled promise rejection';
  const message = reason instanceof Error ? reason.message : reasonText;
  const stack = reason instanceof Error ? reason.stack : undefined;
  if (!shouldEmit(state, buildKey(message, stack))) return;
  postLog(buildLogPayload(message, stack));
}

function install(win: Window): void {
  const state = getBridgeState(win);
  if (state.listening) return;
  state.listening = true;
  win.addEventListener('error', (event) => {
    handleError(state, event);
  });
  win.addEventListener('unhandledrejection', (event) => {
    handleRejection(state, event);
  });
}

if (typeof window !== 'undefined') {
  install(window);
}
