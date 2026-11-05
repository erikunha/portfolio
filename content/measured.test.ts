import { describe, expect, it } from 'vitest';
import { measured } from './measured';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const p95Label = (locale: SiteLocale) =>
  measured[locale].ask.metrics.find((metric) => metric.key === 'p95LatencyMs')?.label;

describe('measured content', () => {
  it('localizes the p95 latency tile label per locale', () => {
    expect(p95Label(SITE_LOCALE.en)).toBe('P95 LATENCY');
    expect(p95Label(SITE_LOCALE.pt)).toBe('LATÊNCIA P95');
  });

  it('keeps the four Lighthouse categories and the desktop then mobile order per locale', () => {
    for (const locale of [SITE_LOCALE.en, SITE_LOCALE.pt]) {
      const { metrics, strategies } = measured[locale].psi;
      expect(metrics.map((metric) => metric.key)).toEqual([
        'performance',
        'accessibility',
        'bestPractices',
        'seo',
      ]);
      expect(strategies.map((strategy) => strategy.key)).toEqual(['desktop', 'mobile']);
    }
  });

  it('localizes the mobile side note per locale', () => {
    expect(measured[SITE_LOCALE.en].psi.strategies[1]?.label).toBe('mobile');
    expect(measured[SITE_LOCALE.pt].psi.strategies[1]?.label).toBe('celular');
  });
});
