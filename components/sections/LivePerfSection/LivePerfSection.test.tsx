import { parse } from 'postcss';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesWithSelector } from '@/__tests__/helpers/css-rules';
import { SITE_LOCALE } from '@/content/site-locale';
import vercelConfig from '@/vercel.json';

const getScoresMock = vi.fn();
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn(async () => undefined),
}));
vi.mock('@/lib/lighthouse-scores', () => ({
  getScores: getScoresMock,
  LIGHTHOUSE_TTL_S: 90_000,
  LIGHTHOUSE_FALLBACK: {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
    fetchedAt: '-',
  },
}));

const REAL_SCORES = {
  performance: 99,
  accessibility: 100,
  bestPractices: 95,
  seo: 100,
  fetchedAt: '2026-05-29T03:00:00.000Z',
};

const strategyScores = (overrides: Partial<typeof REAL_SCORES> & { stale?: boolean }) => ({
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
    expect(valuesOf(html)).toEqual(['- / -', '- / -', '- / -', '- / -']);
  });

  it('shows the unavailable status once for the block, not per tile', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    const doc = new DOMParser().parseFromString(await renderPerfData(), 'text/html');
    const statuses = Array.from(doc.querySelectorAll('p.measured-status'), (p) => p.textContent);
    expect(statuses).toEqual(['unavailable']);
    expect(doc.querySelector('time')).toBeNull();
  });

  it('announces the unavailable status through a polite live region', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    const doc = new DOMParser().parseFromString(await renderPerfData(), 'text/html');
    expect(doc.querySelector('p.measured-status')?.getAttribute('role')).toBe('status');
  });

  it('keeps the healthy side and marks only the failed side with the empty marker', async () => {
    getScoresMock.mockImplementation((strategy: string) =>
      strategy === 'desktop'
        ? Promise.resolve(strategyScores({ performance: 99 }))
        : Promise.reject(new Error('mobile down')),
    );
    const html = await renderPerfData();
    expect(valuesOf(html)).toEqual(['99 / -', '100 / -', '95 / -', '100 / -']);
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
    expect(valuesOf(html)).toEqual(['- / -', '- / -', '- / -', '- / -']);
  });

  it('dates the block by the parseable side when the other side has a corrupt fetchedAt', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    getScoresMock.mockImplementation((strategy: string) =>
      Promise.resolve(
        strategyScores({
          fetchedAt: strategy === 'desktop' ? 'not-a-date' : '2026-10-27T12:00:00Z',
        }),
      ),
    );
    const doc = new DOMParser().parseFromString(await renderPerfData(), 'text/html');
    expect(doc.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-27T12:00:00Z');
    expect(doc.body.textContent).not.toContain('timestamp unavailable');
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
    expect(doc.querySelector('time')).toBeNull();
    pending.resolve(null);
  });
});

const renderLoading = async (locale: typeof SITE_LOCALE.en | typeof SITE_LOCALE.pt) => {
  const { LivePerfSection } = await import('./LivePerfSection');
  const pending = Promise.withResolvers<null>();
  getScoresMock.mockReturnValue(pending.promise);
  const html = renderToStaticMarkup(<LivePerfSection locale={locale} />);
  pending.resolve(null);
  return new DOMParser().parseFromString(html, 'text/html');
};

describe('LivePerfSection: lighthouse loading state', () => {
  it('names the block, says what is being fetched and announces it as a status', async () => {
    const doc = await renderLoading(SITE_LOCALE.en);
    expect(doc.querySelector('.measured-heading')?.textContent).toBe('MEASURED · LIGHTHOUSE');
    const status = doc.querySelector('[role="status"]');
    expect(status?.textContent).toContain('> fetching desktop and mobile runs');
    expect(doc.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows an unfilled bar without printing a percent, hidden from assistive tech', async () => {
    const doc = await renderLoading(SITE_LOCALE.en);
    const bar = doc.querySelector('.measured-load-bar');
    expect(bar?.textContent).toBe('[####........]');
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
    expect(doc.body.textContent).not.toMatch(/\d\s*%/);
  });

  it('keeps the four tiles at their final shape with dashed placeholders', async () => {
    const doc = await renderLoading(SITE_LOCALE.en);
    const tiles = Array.from(doc.querySelectorAll('.measured-tile'), (tile) => ({
      label: tile.querySelector('.measured-label')?.textContent,
      value: tile.querySelector('.measured-value')?.textContent,
      description: tile.querySelector('.measured-description')?.textContent,
    }));
    expect(tiles).toEqual(
      ['perf', 'a11y', 'bp', 'seo'].map((label) => ({
        label,
        value: '-- / --',
        description: 'desktop / mobile',
      })),
    );
  });

  it('reserves the room of the full metric labels so the scores land without a shift', async () => {
    const doc = await renderLoading(SITE_LOCALE.en);
    const reserved = Array.from(doc.querySelectorAll('.measured-label'), (label) =>
      label.getAttribute('data-reserve'),
    );
    expect(reserved).toEqual(['PERFORMANCE', 'ACCESSIBILITY', 'BEST PRACTICES', 'SEO']);
  });

  it('puts a reserved label in the same grid cell as its reserve, so the label is one line tall', async () => {
    const doc = await renderLoading(SITE_LOCALE.en);
    const label = doc.querySelector('.measured-label[data-reserve]');
    const stylesheet = parse(readComponentsCss());
    const spanRule = rulesWithSelector(stylesheet, '.measured-label[data-reserve] > span');
    const reserveRule = rulesWithSelector(stylesheet, '.measured-label[data-reserve]::after');

    expect(Array.from(label?.childNodes ?? [], (node) => node.nodeName)).toEqual(['SPAN']);
    expect(spanRule.map((rule) => declValue(rule, 'grid-area'))).toContain('1 / 1');
    expect(reserveRule.map((rule) => declValue(rule, 'grid-area'))).toContain('1 / 1');
  });

  it('speaks Portuguese on the pt site', async () => {
    const doc = await renderLoading(SITE_LOCALE.pt);
    expect(doc.querySelector('.measured-heading')?.textContent).toBe('MEDIDO · LIGHTHOUSE');
    expect(doc.querySelector('[role="status"]')?.textContent).toContain(
      '> buscando as medições de desktop e celular',
    );
    expect(doc.querySelector('.measured-description')?.textContent).toBe('desktop / celular');
  });

  it('steps the bar with CSS only, and only where motion is allowed', () => {
    // behavioral-test-allow: animation and reduced-motion contracts live in the shipped stylesheet; jsdom runs no animations
    const stylesheet = parse(readComponentsCss());
    const motionSelector = 'body:not([data-motion="reduce"]) .measured-load-bar::after';
    const animatedOutsideGuard: string[] = [];
    let guarded: string | undefined;
    stylesheet.walkRules((rule) => {
      const animation = declValue(rule, 'animation');
      if (!animation?.includes('measured-load-fill')) return;
      const parent = rule.parent;
      const inGuard =
        parent?.type === 'atrule' &&
        /prefers-reduced-motion:\s*no-preference/.test((parent as { params: string }).params);
      if (inGuard && rule.selector === motionSelector) guarded = animation;
      else animatedOutsideGuard.push(rule.selector);
    });
    expect(guarded).toMatch(/steps\(/);
    expect(animatedOutsideGuard).toEqual([]);
    expect(rulesWithSelector(stylesheet, motionSelector)).not.toHaveLength(0);
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

describe('LivePerfSection: last good scores', () => {
  const NOW = '2026-05-29T09:00:00.000Z';
  const refreshTime = () => {
    const cron = vercelConfig.crons.find((entry) => entry.path === '/api/psi-refresh');
    const [minute = '', hour = ''] = cron?.schedule.split(' ') ?? [];
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  };
  const renderStale = async (
    fetchedAt: string,
    locale: typeof SITE_LOCALE.en | typeof SITE_LOCALE.pt = SITE_LOCALE.en,
  ) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    getScoresMock.mockResolvedValue(strategyScores({ fetchedAt, stale: true }));
    const { PerfData } = await import('./LivePerfSection');
    const html = renderToStaticMarkup(await PerfData({ locale }));
    return new DOMParser().parseFromString(html, 'text/html');
  };

  it('has a psi-refresh cron whose time the footnote can read', () => {
    expect(refreshTime()).toMatch(/^\d{2}:\d{2}$/);
  });

  it('explains the stale scores in a status footnote with the age and the next retry', async () => {
    const doc = await renderStale('2026-05-28T03:00:00.000Z');
    const notes = Array.from(doc.querySelectorAll('p.measured-status'), (p) => p.textContent);
    expect(notes).toEqual([
      `~ stale · last good run 30h ago · today's run failed, retrying at ${refreshTime()} UTC`,
    ]);
    expect(doc.querySelector('p.measured-status')?.getAttribute('role')).toBe('status');
  });

  it('still shows the last good scores and leaves the heading free of a second stale marker', async () => {
    const doc = await renderStale('2026-05-28T03:00:00.000Z');
    expect(Array.from(doc.querySelectorAll('.measured-value'), (tile) => tile.textContent)).toEqual(
      ['99 / 99', '100 / 100', '95 / 95', '100 / 100'],
    );
    expect(doc.querySelector('.measured-heading .measured-status')).toBeNull();
  });

  it('counts the age in days once it passes two days', async () => {
    const doc = await renderStale('2026-05-26T09:00:00.000Z');
    expect(doc.querySelector('p.measured-status')?.textContent).toContain('last good run 3d ago');
  });

  it('speaks Portuguese on the pt site', async () => {
    const doc = await renderStale('2026-05-28T03:00:00.000Z', SITE_LOCALE.pt);
    expect(doc.querySelector('p.measured-status')?.textContent).toBe(
      `~ desatualizado · última medição boa há 30h · a de hoje falhou, nova tentativa às ${refreshTime()} UTC`,
    );
  });

  it('shows no footnote for fresh scores', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    getScoresMock.mockResolvedValue(strategyScores({ fetchedAt: '2026-05-29T03:00:00.000Z' }));
    const { PerfData } = await import('./LivePerfSection');
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(await PerfData({ locale: SITE_LOCALE.en })),
      'text/html',
    );
    expect(doc.querySelector('p.measured-status')).toBeNull();
  });
});
