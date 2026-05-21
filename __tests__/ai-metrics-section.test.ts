// __tests__/ai-metrics-section.test.ts
// Behavioral test (CG3): AiMetricsSection is a true Server Component that
// surfaces the /api/ask eval metrics. It renders to static HTML with zero
// client runtime — rendering it server-side and asserting on the produced
// markup proves the guarantee through observable output (same pattern as
// hero-rsc.test.ts).
//
// content/ask-metrics.ts (the Redis-backed reader) is mocked so the test is
// hermetic — no Upstash, no build-time network. The three contract cases:
//   (a) metrics present          → pass-rate + cost figures appear
//   (b) cacheHitRate absent      → no cache row, no stray zero
//   (c) null metrics             → renders the pending state, never throws

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The reader is a module-level mock; each test sets its return value before
// importing the component (the component reads it at render time).
const getAskMetricsMock = vi.fn();
vi.mock('@/content/ask-metrics', () => ({
  getAskMetrics: getAskMetricsMock,
}));

// AiMetricsSection is an async RSC: await the element it resolves to, then
// render that to static markup. The component is invoked as a plain async
// function (no JSX) so this file stays a `.test.ts`.
async function renderSection(): Promise<string> {
  const { AiMetricsSection } = await import('@/components/sections/AiMetricsSection');
  const element = await AiMetricsSection();
  return renderToStaticMarkup(element);
}

afterEach(() => {
  vi.resetModules();
  getAskMetricsMock.mockReset();
});

describe('AiMetricsSection — on-page AI eval/cost metrics (RSC)', () => {
  it('renders the pass-rate and cost figures when metrics are present', async () => {
    getAskMetricsMock.mockResolvedValue({
      evalPassRate: 0.95,
      jailbreakResistance: 1.0,
      cacheHitRate: 0.88,
      costPerAnswer: 0.0021,
      lastRun: '2026-05-20T12:00:00.000Z',
    });

    const html = await renderSection();

    // Eval pass-rate surfaced as a percentage.
    expect(html).toContain('95%');
    // Jailbreak resistance surfaced as a percentage.
    expect(html).toContain('100%');
    // Cost-per-answer surfaced as a dollar figure.
    expect(html).toContain('$0.0021');
    // Cache-hit-rate row present when the field is set.
    expect(html).toContain('88%');
  });

  it('omits the cache row entirely when cacheHitRate is absent — no stray zero', async () => {
    getAskMetricsMock.mockResolvedValue({
      evalPassRate: 0.92,
      jailbreakResistance: 1.0,
      costPerAnswer: 0.0018,
      lastRun: '2026-05-20T12:00:00.000Z',
      // cacheHitRate intentionally omitted
    });

    const html = await renderSection();

    // The other three rows still render.
    expect(html).toContain('92%');
    expect(html).toContain('$0.0018');
    // No cache label leaks in when the field is absent.
    expect(html.toUpperCase()).not.toContain('CACHE');
    // Exactly three metric cells — the cache cell is not emitted, so no
    // stray zero-valued row appears.
    const cellCount = (html.match(/class="aimetric"/g) ?? []).length;
    expect(cellCount).toBe(3);
  });

  it('renders the pending state without throwing when metrics are null', async () => {
    getAskMetricsMock.mockResolvedValue(null);

    let html = '';
    await expect(
      (async () => {
        html = await renderSection();
      })(),
    ).resolves.not.toThrow();

    // Pending state must not break the page: it renders a small panel, not a
    // crash and not the metric rows.
    expect(html).not.toContain('%');
    expect(html.toUpperCase()).toContain('PENDING');
  });
});
