import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITE_LOCALE } from '@/content/site-locale';

const getAskMetricsMock = vi.fn();
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn(async () => undefined),
}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/lighthouse-scores', () => ({
  getScores: vi.fn(),
  LIGHTHOUSE_TTL_S: 90_000,
  LIGHTHOUSE_FALLBACK: {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
    fetchedAt: '-',
  },
}));
vi.mock('@/lib/ask-metrics', () => ({ getAskMetrics: getAskMetricsMock }));

afterEach(() => {
  vi.resetModules();
  getAskMetricsMock.mockReset();
});

async function renderData(locale: typeof SITE_LOCALE.en | typeof SITE_LOCALE.pt) {
  getAskMetricsMock.mockResolvedValue({
    evalPassRate: 0.95,
    jailbreakResistance: 1,
    p95LatencyMs: 2840,
    costPerAnswer: 0.0021,
    lastRun: '2026-05-20T12:00:00.000Z',
  });
  const { AiMetricsData } = await import('./AiMetricsSection');
  return renderToStaticMarkup(await AiMetricsData({ locale }));
}

describe('AiMetricsSection: cost per answer follows the page locale', () => {
  it('writes the pt cost with the decimal comma, like the pt latency tile', async () => {
    const html = await renderData(SITE_LOCALE.pt);
    expect(html).toContain('$0,0021');
    expect(html).not.toContain('$0.0021');
    expect(html).toContain('2.840ms');
  });

  it('writes the en cost with the decimal point', async () => {
    const html = await renderData(SITE_LOCALE.en);
    expect(html).toContain('$0.0021');
  });
});
