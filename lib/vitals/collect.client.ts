'use client';

import type { MetricWithAttribution } from 'web-vitals/attribution';
import { onCLS, onINP, onLCP } from 'web-vitals/attribution';
import { VITALS_ENDPOINT } from '@/lib/vitals/metrics';
import { toWireMetric, type WireMetric, type WirePayload } from '@/lib/vitals/wire';

const PAYLOAD_TYPE = 'application/json';

function buildPayload(metrics: WireMetric[]): WirePayload {
  // biome-ignore lint/style/noProcessEnv: next.config.ts inlines RELEASE into the client bundle at build, which needs the literal process.env.RELEASE, and the client closure must not import the zod env schema
  const release = process.env.RELEASE;
  return {
    path: window.location.pathname,
    vw: window.innerWidth,
    ...(release === undefined ? {} : { release }),
    metrics,
  };
}

export function collectVitals(): void {
  const pending = new Map<string, WireMetric>();
  const reported = new Set<string>();

  const record = (metric: MetricWithAttribution): void => {
    if (reported.has(metric.name)) return;
    const wire = toWireMetric(metric);
    if (!wire) return;
    reported.add(metric.name);
    pending.set(metric.name, wire);
  };

  const flush = (): void => {
    if (pending.size === 0) return;
    const body = new Blob([JSON.stringify(buildPayload([...pending.values()]))], {
      type: PAYLOAD_TYPE,
    });
    pending.clear();
    navigator.sendBeacon(VITALS_ENDPOINT, body);
  };

  onLCP(record);
  onINP(record);
  onCLS(record);

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') setTimeout(flush);
    },
    { capture: true },
  );
  window.addEventListener('pagehide', flush);
}
