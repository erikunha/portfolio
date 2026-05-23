// __tests__/ai-metrics-section.test.ts
// Behavioral test (CG3): AiMetricsSection surfaces /api/ask eval metrics.
// It renders to static HTML with zero client runtime — rendering server-side
// and asserting on the produced markup proves the guarantee (same pattern as
// hero-rsc.test.ts).
//
// AiMetricsSection is now a sync RSC that wraps the async AiMetricsData RSC
// in a <Suspense> boundary (PPR pattern). AiMetricsData is tested directly
// for the data rendering contract — it is the async inner RSC responsible
// for fetching metrics and producing the metrics markup.
//
// content/ask-metrics.ts (the Redis-backed reader) is mocked so the test is
// hermetic — no Upstash, no build-time network. The contract cases:
//   (a) metrics present  → all four tiles (pass-rate, jailbreak, p95
//                          latency, cost) render their figures
//   (b) null metrics     → renders the pending state, never throws

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The reader is a module-level mock; each test sets its return value before
// importing the component (the component reads it at render time).
const getAskMetricsMock = vi.fn();
vi.mock('@/content/ask-metrics', () => ({
  getAskMetrics: getAskMetricsMock,
}));

// AiMetricsData is the async inner RSC that fetches and renders metrics.
// It is invoked as a plain async function so this file stays a `.test.ts`.
async function renderData(): Promise<string> {
  const { AiMetricsData } = await import('@/components/sections/AiMetricsSection');
  const element = await AiMetricsData();
  return renderToStaticMarkup(element);
}

// CSS Modules scopes class names — import styles to get the hashed key for assertions.
async function getStyles() {
  const styles = await import('@/components/sections/AiMetricsSection.module.css');
  return styles.default as Record<string, string>;
}

afterEach(() => {
  vi.resetModules();
  getAskMetricsMock.mockReset();
});

describe('AiMetricsSection — on-page AI eval/cost metrics (RSC)', () => {
  it('renders all four metric tiles when metrics are present', async () => {
    getAskMetricsMock.mockResolvedValue({
      evalPassRate: 0.95,
      jailbreakResistance: 1.0,
      p95LatencyMs: 2840,
      costPerAnswer: 0.0021,
      lastRun: '2026-05-20T12:00:00.000Z',
    });

    const html = await renderData();

    // Eval pass-rate surfaced as a percentage.
    expect(html).toContain('95%');
    // Jailbreak resistance surfaced as a percentage.
    expect(html).toContain('100%');
    // p95 latency surfaced in milliseconds.
    expect(html).toContain('2840ms');
    // Cost-per-answer surfaced as a dollar figure.
    expect(html).toContain('$0.0021');
    // Exactly four metric cells — pass-rate, jailbreak, p95 latency, cost.
    // CSS Modules scopes the class name; use the module key for the regex.
    const s = await getStyles();
    const metricClass = s.metric as string;
    const cellCount = (html.match(new RegExp(`class="${metricClass}"`, 'g')) ?? []).length;
    expect(cellCount).toBe(4);
    // The unmeasured cache-hit-rate row was dropped end-to-end.
    expect(html.toUpperCase()).not.toContain('CACHE');
  });

  it('renders the last-run timestamp as a semantic <time> element', async () => {
    getAskMetricsMock.mockResolvedValue({
      evalPassRate: 0.92,
      jailbreakResistance: 1.0,
      p95LatencyMs: 3100,
      costPerAnswer: 0.0018,
      lastRun: '2026-05-20T12:00:00.000Z',
    });

    const html = await renderData();

    // The timestamp carries a machine-readable dateTime attribute.
    expect(html).toContain('<time dateTime="2026-05-20T12:00:00.000Z"');
  });

  it('renders the pending state without throwing when metrics are null', async () => {
    getAskMetricsMock.mockResolvedValue(null);

    let html = '';
    await expect(
      (async () => {
        html = await renderData();
      })(),
    ).resolves.not.toThrow();

    // Pending state must not break the page: it renders a small panel, not a
    // crash and not the metric rows.
    expect(html).not.toContain('%');
    expect(html.toUpperCase()).toContain('PENDING');
  });
});
