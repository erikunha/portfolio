import { PassThrough } from 'node:stream';
import { parse } from 'postcss';
import { renderToPipeableStream, renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesWithSelector } from '@/__tests__/helpers/css-rules';
import { measured } from '@/content/measured';
import { SITE_LOCALE } from '@/content/site-locale';

const getAskMetricsMock = vi.fn();
const getScoresMock = vi.fn();
const headersMock = vi.fn();
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn(async () => undefined),
}));
vi.mock('next/headers', () => ({ headers: headersMock }));
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

async function renderData(locale: typeof SITE_LOCALE.en | typeof SITE_LOCALE.pt = SITE_LOCALE.en) {
  const { AiMetricsData } = await import('./AiMetricsSection');
  const element = await AiMetricsData({ locale });
  return renderToStaticMarkup(element);
}

afterEach(() => {
  vi.resetModules();
  getAskMetricsMock.mockReset();
  getScoresMock.mockReset();
  headersMock.mockReset();
  vi.useRealTimers();
});

describe('AiMetricsSection: stacked blocks', () => {
  it('renders ASK_EVAL before LIVE_PERF, each over its own tile grid', async () => {
    getAskMetricsMock.mockResolvedValue(null);
    getScoresMock.mockResolvedValue(null);
    const { AiMetricsSection } = await import('./AiMetricsSection');
    const stream = new PassThrough();
    let html = '';
    stream.on('data', (chunk) => {
      html += chunk.toString();
    });
    const ended = new Promise<void>((resolve) => stream.on('end', resolve));
    const pipe = renderToPipeableStream(<AiMetricsSection locale={SITE_LOCALE.en} />, {
      onAllReady() {
        pipe.pipe(stream);
      },
    });
    await ended;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const headings = Array.from(
      doc.querySelectorAll('.measured-grid .measured-heading'),
      (h) => h.textContent?.trim().split(' ')[0],
    );
    expect(headings).toEqual(['ASK_EVAL.JSON', 'LIVE_PERF.JSON']);
    expect(doc.querySelectorAll('.measured-grid .measured-tiles')).toHaveLength(2);
    expect(doc.querySelectorAll('.measured-grid .measured-tile')).toHaveLength(8);
  });
});

describe('AiMetricsSection: on-page AI eval/cost metrics (RSC)', () => {
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

  it('streams the PSI tiles once both strategies resolve while ASK is still pending in one Measured section', async () => {
    const ask = Promise.withResolvers<null>();
    const desktop = Promise.withResolvers<{
      performance: number;
      accessibility: number;
      bestPractices: number;
      seo: number;
      fetchedAt: string;
    }>();
    const psiScores = {
      performance: 88,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: new Date().toISOString(),
    };
    getAskMetricsMock.mockReturnValue(ask.promise);
    getScoresMock.mockImplementation((strategy: string) =>
      strategy === 'desktop' ? desktop.promise : Promise.resolve(psiScores),
    );
    const { AiMetricsSection } = await import('./AiMetricsSection');
    const output = new PassThrough();
    let html = '';
    const psiArrived = new Promise<void>((resolve) => {
      output.on('data', (chunk) => {
        html += chunk.toString();
        if (html.includes('88 / 88')) resolve();
      });
    });
    const ended = new Promise<void>((resolve) => output.on('end', resolve));
    const stream = renderToPipeableStream(<AiMetricsSection locale={SITE_LOCALE.en} />, {
      onShellReady() {
        stream.pipe(output);
      },
    });
    desktop.resolve(psiScores);
    await psiArrived;
    expect(html).toContain('Measured');
    expect(html).toContain('sec-live-metrics');
    expect(html.match(/<section\b/g) ?? []).toHaveLength(1);
    expect(html).toContain('aria-busy="true"');
    ask.resolve(null);
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

  it.each([
    [
      SITE_LOCALE.en,
      'timeout',
      'The store did not answer in 3s. The site works; this panel will try again on the next visit.',
    ],
    [
      SITE_LOCALE.pt,
      'timeout',
      'O armazenamento não respondeu em 3s. O site funciona; este painel tenta de novo na próxima visita.',
    ],
    [
      SITE_LOCALE.en,
      'not configured',
      'The store could not be read. The site works; this panel will try again on the next visit.',
    ],
    [
      SITE_LOCALE.pt,
      'not configured',
      'Não foi possível ler o armazenamento. O site funciona; este painel tenta de novo na próxima visita.',
    ],
    [
      SITE_LOCALE.en,
      'other failure',
      'The store could not be read. The site works; this panel will try again on the next visit.',
    ],
    [
      SITE_LOCALE.pt,
      'other failure',
      'Não foi possível ler o armazenamento. O site funciona; este painel tenta de novo na próxima visita.',
    ],
  ] as const)('explains the %s %s cause in the error box', async (locale, cause, explanation) => {
    const { ReadTimeoutError } = await import('@/lib/with-timeout');
    const { RedisNotConfiguredError } = await import('@/lib/rate-limit');
    const error =
      cause === 'timeout'
        ? new ReadTimeoutError()
        : cause === 'not configured'
          ? new RedisNotConfiguredError()
          : new Error('adapter offline');
    getAskMetricsMock.mockRejectedValue(error);

    const doc = new DOMParser().parseFromString(await renderData(locale), 'text/html');
    const box = doc.querySelector('.measured-error');
    expect(box?.querySelector('strong')?.textContent).toBe(
      locale === SITE_LOCALE.en
        ? '! eval results unavailable'
        : '! resultados do eval indisponíveis',
    );
    expect(box?.querySelector('p')?.textContent).toBe(explanation);
    expect(doc.body.textContent).not.toContain(measured[locale].ask.pending);
    expect(doc.querySelector('time')).toBeNull();
    expect(doc.querySelector('[aria-busy]')).toBeNull();
    expect(doc.querySelectorAll('.measured-tile')).toHaveLength(0);
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
    expect(html).toContain(measured[SITE_LOCALE.en].ask.pending);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('.measured-status')?.textContent).toBe(
      measured[SITE_LOCALE.en].ask.pending,
    );
  });

  it('announces the error as an alert, inside the block the data fills', async () => {
    getAskMetricsMock.mockRejectedValue(new Error('adapter offline'));
    const doc = new DOMParser().parseFromString(await renderData(), 'text/html');
    const box = doc.querySelector('.measured-ask .measured-error');
    expect(box?.getAttribute('role')).toBe('alert');
  });

  it('announces the pending state through a polite live region', async () => {
    getAskMetricsMock.mockResolvedValue(null);
    const doc = new DOMParser().parseFromString(await renderData(), 'text/html');
    expect(doc.querySelector('.measured-status')?.getAttribute('role')).toBe('status');
  });

  it('keeps the same status room whether the block shows data, the pending copy or the loading copy', async () => {
    const content = measured[SITE_LOCALE.en];
    const longest = [
      content.loading,
      content.ask.unavailable,
      content.ask.pending,
      content.unknownTimestamp,
    ].reduce((winner, candidate) => (candidate.length > winner.length ? candidate : winner));
    getAskMetricsMock.mockResolvedValueOnce({
      evalPassRate: 0.9,
      jailbreakResistance: 1,
      p95LatencyMs: 3100,
      costPerAnswer: 0.0018,
      lastRun: new Date().toISOString(),
    });
    const withData = new DOMParser().parseFromString(await renderData(), 'text/html');
    getAskMetricsMock.mockResolvedValueOnce(null);
    const pending = new DOMParser().parseFromString(await renderData(), 'text/html');

    for (const doc of [withData, pending]) {
      expect(doc.querySelector('.measured-status-slot')?.getAttribute('data-reserve')).toBe(
        longest,
      );
    }
    expect(withData.querySelector('.measured-status-slot p')).toBeNull();
  });
});

describe('AiMetricsSection: error box', () => {
  const failed = async (locale?: typeof SITE_LOCALE.en | typeof SITE_LOCALE.pt) => {
    getAskMetricsMock.mockRejectedValue(new Error('adapter offline'));
    return new DOMParser().parseFromString(await renderData(locale), 'text/html');
  };

  it('offers RETRY as a plain link that reloads the section, with no script or button', async () => {
    const doc = await failed();
    const retry = doc.querySelector('.measured-error a.measured-retry');
    expect(retry?.textContent).toBe('[ RETRY ]');
    expect(retry?.getAttribute('href')).toMatch(/^\?.+#sec-live-metrics$/);
    expect(doc.querySelector('.measured-error button')).toBeNull();
    expect(doc.querySelector('script')).toBeNull();
  });

  it('shows the request id ellipsized, with the full id in the title', async () => {
    headersMock.mockResolvedValue(new Headers({ 'x-vercel-id': 'gru1::iad1::abcde-1730000-xyz' }));
    const doc = await failed();
    const ref = doc.querySelector('.measured-error-ref');
    expect(ref?.textContent).toBe('ref gru1::iad1::abcde-1730000-xyz');
    expect(ref?.getAttribute('title')).toBe('gru1::iad1::abcde-1730000-xyz');
  });

  it.each([
    ['the request carries no id', () => headersMock.mockResolvedValue(new Headers())],
    ['there is no request scope', () => headersMock.mockRejectedValue(new Error('outside scope'))],
  ])('omits the ref line when %s', async (_name, arrange) => {
    arrange();
    const doc = await failed();
    expect(doc.querySelector('.measured-error-ref')).toBeNull();
    expect(doc.querySelector('.measured-retry')).not.toBeNull();
  });

  it('speaks Portuguese on the pt site', async () => {
    const doc = await failed(SITE_LOCALE.pt);
    expect(doc.querySelector('.measured-error strong')?.textContent).toBe(
      '! resultados do eval indisponíveis',
    );
    expect(doc.querySelector('.measured-retry')?.textContent).toBe('[ TENTAR ]');
  });

  it('draws the box in full lime and keeps the retry target at least 44px tall', () => {
    // behavioral-test-allow: border color and target size live in the shipped stylesheet; jsdom has no layout engine
    const stylesheet = parse(readComponentsCss());
    const box = rulesWithSelector(stylesheet, '.measured-error');
    expect(box.map((rule) => declValue(rule, 'border'))).toContain(
      'var(--border-width) solid var(--color-primary-500)',
    );
    const retry = rulesWithSelector(stylesheet, '.measured-retry');
    expect(retry.map((rule) => declValue(rule, 'min-height'))).toContain('var(--spacing-target)');
  });
});
