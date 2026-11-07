import { describe, expect, it } from 'vitest';
import desktop from '../lighthouserc.json';
import mobile from '../lighthouserc.mobile.json';

type Options = { minScore?: number; maxNumericValue?: number };
type Assertion = string | [string, Options?];
type Config = { ci: { assert: { assertions: Record<string, Assertion> } } };

const ERROR_LEVEL = 'error';

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
