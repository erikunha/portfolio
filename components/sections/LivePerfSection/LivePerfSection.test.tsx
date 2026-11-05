import { parse } from 'postcss';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesWithSelector } from '@/__tests__/helpers/css-rules';
import { SITE_LOCALE } from '@/content/site-locale';

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

const REAL_SCORES = {
  performance: 99,
  accessibility: 100,
  bestPractices: 95,
  seo: 100,
  fetchedAt: '2026-05-29T03:00:00.000Z',
};

const strategyScores = (overrides: Partial<typeof REAL_SCORES>) => ({
  ...REAL_SCORES,
  ...overrides,
});

async function renderPerfData(): Promise<string> {
  const { PerfData } = await import('./LivePerfSection');
  const element = await PerfData({ locale: SITE_LOCALE.en });
  return renderToStaticMarkup(element);
}

const valuesOf = (html: string) =>
  Array.from(
    new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.measured-value'),
    (tile) => tile.textContent,
  );

afterEach(() => {
  vi.resetModules();
  getScoresMock.mockReset();
  vi.useRealTimers();
});

describe('LivePerfSection: fetch-error fallback', () => {
  it('renders without throwing when getScores throws for both strategies', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    await expect(renderPerfData()).resolves.toBeDefined();
  });

  it('does not render fabricated 100 scores on fetch failure', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    const html = await renderPerfData();
    expect(html).not.toContain('100');
    expect(valuesOf(html)).toEqual(['— / —', '— / —', '— / —', '— / —']);
  });

  it('shows the unavailable status once for the block, not per tile', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    const doc = new DOMParser().parseFromString(await renderPerfData(), 'text/html');
    const statuses = Array.from(doc.querySelectorAll('p.measured-status'), (p) => p.textContent);
    expect(statuses).toEqual(['unavailable']);
    expect(doc.querySelector('time')).toBeNull();
  });

  it('keeps the healthy side and marks only the failed side with the empty marker', async () => {
    getScoresMock.mockImplementation((strategy: string) =>
      strategy === 'desktop'
        ? Promise.resolve(strategyScores({ performance: 99 }))
        : Promise.reject(new Error('mobile down')),
    );
    const html = await renderPerfData();
    expect(valuesOf(html)).toEqual(['99 / —', '100 / —', '95 / —', '100 / —']);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(Array.from(doc.querySelectorAll('p.measured-status'), (p) => p.textContent)).toEqual([]);
    expect(doc.querySelector('time')?.getAttribute('datetime')).toBe(REAL_SCORES.fetchedAt);
  });
});

describe('LivePerfSection: tile content', () => {
  it('renders one tile per category with desktop / mobile values and a localized note', async () => {
    getScoresMock.mockImplementation((strategy: string) =>
      Promise.resolve(
        strategy === 'desktop'
          ? strategyScores({ performance: 99 })
          : strategyScores({ performance: 94, bestPractices: 92 }),
      ),
    );
    const doc = new DOMParser().parseFromString(await renderPerfData(), 'text/html');
    const tiles = Array.from(doc.querySelectorAll('.measured-tile'));
    expect(tiles.map((tile) => tile.querySelector('.measured-label')?.textContent)).toEqual([
      'PERFORMANCE',
      'ACCESSIBILITY',
      'BEST PRACTICES',
      'SEO',
    ]);
    expect(tiles.map((tile) => tile.querySelector('.measured-value')?.textContent)).toEqual([
      '99 / 94',
      '100 / 100',
      '95 / 92',
      '100 / 100',
    ]);
    for (const tile of tiles) {
      expect(tile.querySelector('.measured-description')?.textContent).toBe('desktop / mobile');
    }
    expect(doc.querySelectorAll('[role="progressbar"]')).toHaveLength(0);
  });

  it('calls getScores for both strategies', async () => {
    getScoresMock.mockResolvedValue(REAL_SCORES);
    await renderPerfData();
    expect(getScoresMock).toHaveBeenCalledWith('desktop');
    expect(getScoresMock).toHaveBeenCalledWith('mobile');
  });

  it('renders semantic timestamps, a source link and a stale notice for old PSI scores', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    getScoresMock.mockResolvedValue(strategyScores({ fetchedAt: '2026-10-01T12:00:00Z' }));
    const doc = new DOMParser().parseFromString(await renderPerfData(), 'text/html');
    expect(doc.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-01T12:00:00Z');
    expect(doc.body.textContent).toContain('stale');
    expect(doc.querySelector('a')?.getAttribute('href')).toContain('pagespeed.web.dev');
  });

  it('dates the block by its oldest side so a fresh side cannot hide a stale one', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    getScoresMock.mockImplementation((strategy: string) =>
      Promise.resolve(
        strategyScores({
          fetchedAt: strategy === 'desktop' ? '2026-10-27T12:00:00Z' : '2026-10-01T12:00:00Z',
        }),
      ),
    );
    const doc = new DOMParser().parseFromString(await renderPerfData(), 'text/html');
    expect(doc.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-01T12:00:00Z');
    expect(doc.body.textContent).toContain('stale');
  });

  it('handles null scores without rendering fabricated scores or a timestamp', async () => {
    getScoresMock.mockResolvedValue(null);
    const html = await renderPerfData();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.body.textContent).toContain('unavailable');
    expect(doc.querySelector('time')).toBeNull();
    expect(valuesOf(html)).toEqual(['— / —', '— / —', '— / —', '— / —']);
  });

  it('shows scores without the unavailable label when fetchedAt does not parse', async () => {
    getScoresMock.mockResolvedValue(strategyScores({ fetchedAt: 'not-a-date' }));
    const html = await renderPerfData();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const status = doc.querySelector('p.measured-status')?.textContent ?? '';
    expect(status).toBe('timestamp unavailable');
    expect(valuesOf(html)).toEqual(['99 / 99', '100 / 100', '95 / 95', '100 / 100']);
  });
});

describe('LivePerfSection: loading shell', () => {
  it('renders the loading fallback busy, with empty-marker pairs and no timestamp', async () => {
    const { LivePerfSection } = await import('./LivePerfSection');
    const pending = Promise.withResolvers<null>();
    getScoresMock.mockReturnValue(pending.promise);
    const html = renderToStaticMarkup(<LivePerfSection locale={SITE_LOCALE.en} />);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.getElementById('sec-live-perf')).not.toBeNull();
    expect(doc.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(doc.querySelector('p.measured-status')?.textContent).toBe('loading…');
    expect(doc.querySelector('time')).toBeNull();
    pending.resolve(null);
  });
});

describe('LivePerfSection: tile grid layout', () => {
  it('uses the shared tile grid: two columns by default, four from a wide container', () => {
    // behavioral-test-allow: the tile grid contract lives in the shipped stylesheet; jsdom has no layout engine
    const stylesheet = parse(readComponentsCss());
    const base = rulesWithSelector(stylesheet, '.measured-tiles');
    expect(base.map((rule) => declValue(rule, 'grid-template-columns'))).toContain(
      'repeat(2, minmax(0, 1fr))',
    );
    const wide: string[] = [];
    stylesheet.walkAtRules('container', (atRule) => {
      atRule.walkRules('.measured-tiles', (rule) => {
        wide.push(declValue(rule, 'grid-template-columns') ?? '');
      });
    });
    expect(wide).toEqual(['repeat(4, minmax(0, 1fr))']);
  });

  it('stacks the two blocks in one column at every width', () => {
    // behavioral-test-allow: the stack contract lives in the shipped stylesheet; jsdom has no layout engine
    const stylesheet = parse(readComponentsCss());
    const grid = rulesWithSelector(stylesheet, '.measured-grid');
    expect(grid.map((rule) => declValue(rule, 'grid-template-columns'))).toEqual([
      'minmax(0, 1fr)',
    ]);
  });
});
