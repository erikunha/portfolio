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
});
