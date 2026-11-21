import { describe, expect, it } from 'vitest';

const LIMITER_EXPORTS = [
  'getAskLimit',
  'getContactLimit',
  'getCspReportLimit',
  'getErrorLogDailyLimit',
  'getErrorLogIpDailyLimit',
  'getErrorLogLimit',
  'getForgetLimit',
  'getHealthzLimit',
  'getLighthouseLimit',
  'getMcpLimit',
];

describe('lib/rate-limit runtime exports', () => {
  it('exports only the limiter getters, never budget, dedup, eval store, Redis or client IP names', async () => {
    const rateLimit = await import('@/lib/rate-limit');
    expect(Object.keys(rateLimit).sort()).toEqual(LIMITER_EXPORTS);
  });
});
