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

async function renderPerfData(): Promise<string> {
  const { PerfData } = await import('./LivePerfSection');
  const element = await PerfData();
  return renderToStaticMarkup(element);
}

afterEach(() => {
  vi.resetModules();
  getScoresMock.mockReset();
});

describe('LivePerfSection — fetch-error fallback', () => {
  it('renders without throwing when getScores throws', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    await expect(renderPerfData()).resolves.not.toThrow();
  });

  it('does not render fabricated 100 scores on fetch failure', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    const html = await renderPerfData();
    expect(html).not.toContain('>100<');
  });
});
