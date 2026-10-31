import { parse } from 'postcss';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesInMedia, rulesWithSelector } from '@/__tests__/helpers/css-rules';

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

async function renderPerfData(strategy: 'desktop' | 'mobile'): Promise<string> {
  const { PerfData } = await import('./LivePerfSection');
  const element = await PerfData({ strategy });
  return renderToStaticMarkup(element);
}

afterEach(() => {
  vi.resetModules();
  getScoresMock.mockReset();
  vi.useRealTimers();
});

describe('LivePerfSection — fetch-error fallback', () => {
  it('renders without throwing when getScores throws for desktop', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    await expect(renderPerfData('desktop')).resolves.toBeDefined();
  });

  it('renders without throwing when getScores throws for mobile', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    await expect(renderPerfData('mobile')).resolves.toBeDefined();
  });

  it('does not render fabricated 100 scores on fetch failure for desktop', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    const html = await renderPerfData('desktop');
    expect(html).not.toContain('>100<');
  });

  it('does not render fabricated 100 scores on fetch failure for mobile', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    const html = await renderPerfData('mobile');
    expect(html).not.toContain('>100<');
  });
});

describe('LivePerfSection — strategy routing', () => {
  it('renders semantic timestamps, a source link and a stale notice for old PSI scores', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    getScoresMock.mockResolvedValue({
      performance: 88,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: '2026-10-01T12:00:00Z',
    });
    const doc = new DOMParser().parseFromString(await renderPerfData('mobile'), 'text/html');
    expect(doc.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-01T12:00:00Z');
    expect(doc.body.textContent).toContain('stale');
    expect(doc.querySelector('a')?.getAttribute('href')).toContain('pagespeed.web.dev');
    expect(doc.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('88');
  });

  it('handles null scores without rendering fabricated scores or a timestamp', async () => {
    getScoresMock.mockResolvedValue(null);
    const doc = new DOMParser().parseFromString(await renderPerfData('desktop'), 'text/html');
    expect(doc.body.textContent).toContain('unavailable');
    expect(doc.querySelector('time')).toBeNull();
    expect(doc.querySelector('[aria-valuenow="100"]')).toBeNull();
  });
  it('shows scores without the unavailable label when fetchedAt does not parse', async () => {
    getScoresMock.mockResolvedValue({
      performance: 88,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: 'not-a-date',
    });
    const doc = new DOMParser().parseFromString(await renderPerfData('mobile'), 'text/html');
    const status = doc.querySelector('.measured-status')?.textContent ?? '';
    expect(status).toContain('timestamp unavailable');
    expect(status.replace('timestamp unavailable', '')).not.toContain('unavailable');
    expect(doc.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('88');
  });

  it('calls getScores with desktop strategy', async () => {
    getScoresMock.mockResolvedValue({
      performance: 99,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: '2026-05-29T03:00:00.000Z',
    });
    await renderPerfData('desktop');
    expect(getScoresMock).toHaveBeenCalledWith('desktop');
  });

  it('calls getScores with mobile strategy', async () => {
    getScoresMock.mockResolvedValue({
      performance: 90,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: '2026-05-29T03:00:00.000Z',
    });
    await renderPerfData('mobile');
    expect(getScoresMock).toHaveBeenCalledWith('mobile');
  });

  it('renders the score value from getScores', async () => {
    getScoresMock.mockResolvedValue({
      performance: 88,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: '2026-05-29T03:00:00.000Z',
    });
    const html = await renderPerfData('mobile');
    expect(html).toContain('88');
  });
});

describe('LivePerfSection — live indicator', () => {
  it.each(['desktop', 'mobile'] as const)(
    'renders an aria-hidden live dot before the %s label',
    async (strategy) => {
      getScoresMock.mockResolvedValue(null);
      const doc = new DOMParser().parseFromString(await renderPerfData(strategy), 'text/html');
      const heading = doc.querySelector('.measured-subheading');
      const dot = heading?.firstElementChild;
      expect(dot?.classList.contains('live-dot')).toBe(true);
      expect(dot?.getAttribute('aria-hidden')).toBe('true');
      expect(heading?.textContent).toBe(strategy.toUpperCase());
    },
  );
});

describe('LivePerfSection: score tile layout', () => {
  it('sizes the score tracks from the panel width, so a score label can never break mid-word', () => {
    // behavioral-test-allow: the score grid contract lives in the shipped stylesheet; jsdom has no layout engine
    const stylesheet = parse(readComponentsCss());
    const desktop = rulesInMedia(stylesheet, /min-width: 768px/, '.measured-perf .measured-scores');
    expect(desktop).toHaveLength(1);
    expect(declValue(desktop[0], 'grid-template-columns')).toBe(
      'repeat(auto-fit, minmax(var(--measured-tile-min), 1fr))',
    );
    const minTrack = rulesWithSelector(stylesheet, '.measured-perf')
      .map((rule) => declValue(rule, '--measured-tile-min'))
      .find((value) => value !== undefined);
    expect(minTrack).toBe('7rem');
  });

  it('never forces four score columns from a viewport breakpoint', () => {
    // behavioral-test-allow: the score grid contract lives in the shipped stylesheet; jsdom has no layout engine
    const stylesheet = parse(readComponentsCss());
    const fourColumn = rulesWithSelector(stylesheet, '.measured-perf .measured-scores').filter(
      (rule) => (declValue(rule, 'grid-template-columns') ?? '').includes('repeat(4'),
    );
    expect(fourColumn).toEqual([]);
  });
});
