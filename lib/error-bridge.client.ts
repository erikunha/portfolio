'use client';

const DEDUP_TAIL_MS = 100;
export const MAX_DEDUP_SIZE = 100;

const BRIDGE_STATE_KEY = Symbol.for('erikunha.dev/error-bridge');

type BridgeState = {
  recentEmissions: Map<string, number>;
  listening: boolean;
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
    url: typeof window !== 'undefined' ? window.location.href : '',
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
  const created: BridgeState = { recentEmissions: new Map<string, number>(), listening: false };
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

function send(payload: Payload): void {
  void fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

function handleError(state: BridgeState, event: ErrorEvent): void {
  const message = event.message ?? 'unknown error';
  const stack = event.error instanceof Error ? event.error.stack : undefined;
  if (!shouldEmit(state, buildKey(message, stack))) return;
  send(buildLogPayload(message, stack));
}

function handleRejection(state: BridgeState, event: PromiseRejectionEvent): void {
  const reason = event.reason;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'unhandled promise rejection';
  const stack = reason instanceof Error ? reason.stack : undefined;
  if (!shouldEmit(state, buildKey(message, stack))) return;
  send(buildLogPayload(message, stack));
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
