import { describe, expect, it } from 'vitest';
import desktop from '../lighthouserc.json';
import mobile from '../lighthouserc.mobile.json';

type Options = { minScore?: number; maxNumericValue?: number };
type Assertion = string | [string, Options?];
type Config = { ci: { assert: { assertions: Record<string, Assertion> } } };

const ERROR_LEVEL = 'error';

const REPLACED_AUDIT_IDS = [
  'critical-request-chains',
  'dom-size',
  'duplicated-javascript',
  'efficient-animated-content',
  'font-display',
  'interaction-to-next-paint-insight',
  'largest-contentful-paint-element',
  'layout-shifts',
  'lcp-lazy-loaded',
  'lcp-phases-insight',
  'legacy-javascript',
  'modern-image-formats',
  'prioritize-lcp-image',
  'redirects',
  'render-blocking-resources',
  'server-response-time',
  'third-party-summary',
  'uses-http2',
  'uses-long-cache-ttl',
  'uses-optimized-images',
  'uses-rel-preconnect',
  'uses-responsive-images',
  'uses-text-compression',
  'viewport',
  'work-during-interaction',
];

const INSIGHT_ERROR_GATES = [
  'document-latency-insight',
  'image-delivery-insight',
  'font-display-insight',
];

const budgets = [
  {
    name: 'desktop',
    config: desktop as unknown as Config,
    minScores: {
      'categories:performance': 0.95,
      'categories:accessibility': 1,
      'categories:best-practices': 0.95,
      'categories:seo': 1,
    },
    maxValues: {
      'largest-contentful-paint': 1800,
      'cumulative-layout-shift': 0.05,
      'total-blocking-time': 200,
    },
  },
  {
    name: 'mobile',
    config: mobile as unknown as Config,
    minScores: {
      'categories:performance': 0.9,
      'categories:accessibility': 1,
      'categories:best-practices': 0.95,
      'categories:seo': 1,
    },
    maxValues: {
      'largest-contentful-paint': 3500,
      'cumulative-layout-shift': 0.05,
      'total-blocking-time': 400,
    },
  },
];

describe.each(budgets)('$name Lighthouse budget', ({ config, minScores, maxValues }) => {
  const assertion = (audit: string): [string | undefined, Options] => {
    const entry = config.ci.assert.assertions[audit];
    if (Array.isArray(entry)) return [entry[0], entry[1] ?? {}];
    return [entry, {}];
  };

  it.each(Object.entries(minScores))('keeps %s an error at or above %s', (audit, floor) => {
    const [level, options] = assertion(audit);
    expect(level, `${audit} must stay an error, never warn or off`).toBe(ERROR_LEVEL);
    expect(
      options.minScore ?? 0,
      `${audit} minScore was lowered below the documented budget`,
    ).toBeGreaterThanOrEqual(floor);
  });

  it.each(Object.entries(maxValues))('keeps %s an error at or below %s', (audit, ceiling) => {
    const [level, options] = assertion(audit);
    expect(level, `${audit} must stay an error, never warn or off`).toBe(ERROR_LEVEL);
    expect(
      options.maxNumericValue ?? Number.POSITIVE_INFINITY,
      `${audit} maxNumericValue was raised above the documented budget`,
    ).toBeLessThanOrEqual(ceiling);
  });
});

describe.each(budgets)('$name Lighthouse assertion ids', ({ config }) => {
  const assertions = config.ci.assert.assertions;

  it.each(REPLACED_AUDIT_IDS)('asserts no audit id LHCI has replaced: %s', (legacyId) => {
    expect(
      Object.keys(assertions),
      `${legacyId} is mapped to an insight audit by LHCI and the mapping is being removed`,
    ).not.toContain(legacyId);
  });

  it.each(INSIGHT_ERROR_GATES)('keeps %s an active error gate', (insightId) => {
    const entry = assertions[insightId];
    const level = Array.isArray(entry) ? entry[0] : entry;
    expect(level, `${insightId} replaced a legacy gate and must not be off or warn`).toBe(
      ERROR_LEVEL,
    );
  });

  it('keeps render-blocking-insight on, capped at three blocking resources', () => {
    const entry = assertions['render-blocking-insight'];
    expect(Array.isArray(entry) ? entry[0] : entry).not.toBe('off');
    expect(Array.isArray(entry) ? (entry[1] as { maxLength?: number })?.maxLength : undefined).toBe(
      3,
    );
  });
});
