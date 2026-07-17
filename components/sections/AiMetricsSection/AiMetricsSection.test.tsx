import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getAskMetricsMock = vi.fn();
vi.mock('@/lib/ask-metrics', () => ({
  getAskMetrics: getAskMetricsMock,
}));

async function renderData(): Promise<string> {
  const { AiMetricsData } = await import('./AiMetricsSection');
  const element = await AiMetricsData();
  return renderToStaticMarkup(element);
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

    expect(html).toContain('95%');
    expect(html).toContain('100%');
    expect(html).toContain('2840ms');
    expect(html).toContain('$0.0021');
    const cellCount = (html.match(/data-metric/g) ?? []).length;
    expect(cellCount).toBe(4);
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

    expect(html).not.toContain('%');
    expect(html.toUpperCase()).toContain('PENDING');
  });
});
