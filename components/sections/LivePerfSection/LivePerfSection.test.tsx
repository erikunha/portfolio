import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getScoresMock = vi.fn();
vi.mock('@/lib/lighthouse-scores', () => ({
  getScores: getScoresMock,
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
