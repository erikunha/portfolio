import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITE_LOCALE } from '@/content/site-locale';
import { ASK_MODEL } from '@/lib/ask/model';

const getAskMetricsMock = vi.fn();
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn(async () => undefined),
}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/ask/metrics', () => ({ getAskMetrics: getAskMetricsMock }));

const NOW = new Date('2026-11-16T12:00:00Z');
const FRESH_RUN = '2026-11-15T05:00:00Z';
const METRICS = {
  evalPassRate: 0.95,
  jailbreakResistance: 1,
  p95LatencyMs: 2840,
  costPerAnswer: 0.0021,
  lastRun: FRESH_RUN,
};

async function render(
  metrics: object,
  locale: (typeof SITE_LOCALE)[keyof typeof SITE_LOCALE] = SITE_LOCALE.en,
): Promise<string> {
  getAskMetricsMock.mockResolvedValue(metrics);
  const { AiMetricsData } = await import('./AiMetricsSection');
  return renderToStaticMarkup(await AiMetricsData({ locale }));
}

afterEach(() => {
  vi.resetModules();
  getAskMetricsMock.mockReset();
  vi.useRealTimers();
});

describe('ASK_EVAL panel: an eval of another model is labeled stale however recent it is', () => {
  it('shows no stale label for a fresh eval of the shipped model', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(await render({ ...METRICS, featureModel: ASK_MODEL })).not.toContain('stale');
  });

  it('labels a fresh eval of an older model stale', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(await render({ ...METRICS, featureModel: 'anthropic/claude-haiku-4-5' })).toContain(
      'stale',
    );
  });

  it('labels a fresh eval that records no model stale', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(await render(METRICS)).toContain('stale');
  });

  it('labels a fresh eval of an older model stale in pt-BR', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(
      await render({ ...METRICS, featureModel: 'anthropic/claude-haiku-4-5' }, SITE_LOCALE.pt),
    ).toContain('desatualizado');
  });
});
