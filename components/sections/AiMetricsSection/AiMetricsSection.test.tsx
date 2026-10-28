import { PassThrough } from 'node:stream';
import { renderToPipeableStream, renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getAskMetricsMock = vi.fn();
const getScoresMock = vi.fn();
vi.mock('@/lib/lighthouse-scores', () => ({
  getScores: getScoresMock,
  LIGHTHOUSE_TTL_S: 90_000,
  LIGHTHOUSE_FALLBACK: {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
    fetchedAt: '—',
  },
}));
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
  getScoresMock.mockReset();
  vi.useRealTimers();
});

describe('AiMetricsSection — on-page AI eval/cost metrics (RSC)', () => {
  it('explains p95 and links the source without replacing real values', async () => {
    getAskMetricsMock.mockResolvedValue({
      evalPassRate: 0.95,
      jailbreakResistance: 1,
      p95LatencyMs: 2840,
      costPerAnswer: 0.0021,
      lastRun: new Date().toISOString(),
    });
    const doc = new DOMParser().parseFromString(await renderData(), 'text/html');
    expect(doc.body.textContent).toContain('95% of answers finish within 2,840ms');
    expect(doc.querySelector('a')?.getAttribute('href')).toBe(
      'https://github.com/erikunha/portfolio/blob/main/scripts/ask-eval.ts',
    );
  });

  it('marks stale eval data while keeping the measured values and timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    getAskMetricsMock.mockResolvedValue({
      evalPassRate: 0.95,
      jailbreakResistance: 1,
      p95LatencyMs: 2840,
      costPerAnswer: 0.0021,
      lastRun: '2026-10-01T12:00:00Z',
    });
    const html = await renderData();
    expect(html).toContain('stale');
    expect(html).toContain('95%');
    expect(html).toContain('2026-10-01T12:00:00Z');
  });

  it('streams mobile PSI while ASK and desktop PSI are still pending in one Measured section', async () => {
    const ask = Promise.withResolvers<null>();
    const desktop = Promise.withResolvers<null>();
    getAskMetricsMock.mockReturnValue(ask.promise);
    getScoresMock.mockImplementation((strategy: string) =>
      strategy === 'desktop'
        ? desktop.promise
        : Promise.resolve({
            performance: 88,
            accessibility: 100,
            bestPractices: 95,
            seo: 100,
            fetchedAt: new Date().toISOString(),
          }),
    );
    const { AiMetricsSection } = await import('./AiMetricsSection');
    const output = new PassThrough();
    let html = '';
    const mobileArrived = new Promise<void>((resolve) => {
      output.on('data', (chunk) => {
        html += chunk.toString();
        if (html.includes('>88<')) resolve();
      });
    });
    const ended = new Promise<void>((resolve) => output.on('end', resolve));
    const stream = renderToPipeableStream(<AiMetricsSection />, {
      onShellReady() {
        stream.pipe(output);
      },
    });
    await mobileArrived;
    expect(html).toContain('Measured');
    expect(html).toContain('sec-live-metrics');
    expect(html.match(/<section\b/g) ?? []).toHaveLength(1);
    expect(html).toContain('aria-busy="true"');
    ask.resolve(null);
    desktop.resolve(null);
    await ended;
  });
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
    expect(html).toContain('2,840ms');
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

    expect(html).toContain('95% of answers finish within this time');
    expect(html).not.toContain('>100%<');
    expect(html).not.toContain('>0%<');
    expect(html.toUpperCase()).toContain('PENDING');
  });
});
