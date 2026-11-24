'use client';

const IDLE_TIMEOUT_MS = 4000;
const IDLE_FALLBACK_MS = 2000;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

let started = false;

function whenIdle(task: () => void): void {
  const win = window as IdleWindow;
  if (win.requestIdleCallback) win.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
  else setTimeout(task, IDLE_FALLBACK_MS);
}

function afterLoad(task: () => void): void {
  if (document.readyState === 'complete') task();
  else window.addEventListener('load', task, { once: true });
}

export function startVitalsReporting(): void {
  if (started || typeof window === 'undefined') return;
  if (typeof navigator.sendBeacon !== 'function' || !('PerformanceObserver' in window)) return;
  started = true;
  afterLoad(() =>
    whenIdle(() => {
      void import('@/lib/vitals/collect.client').then(({ collectVitals }) => collectVitals());
    }),
  );
}
