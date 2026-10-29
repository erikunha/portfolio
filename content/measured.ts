import { MeasuredSchema } from './schemas';

export const measured = MeasuredSchema.parse({
  format: {
    locale: 'en-US',
    percentScale: 100,
    costPrecision: 4,
    dateLength: 10,
    millisecondsPerSecond: 1000,
    askStaleAfterMs: 7 * 24 * 60 * 60 * 1000,
    empty: '—',
  },
  title: 'Measured',
  command: 'MEASURED.JSON',
  sourceLabel: 'source:',
  externalDisclosure: '(opens in a new tab)',
  unavailable: 'unavailable',
  loading: 'loading…',
  stale: 'stale',
  unknownTimestamp: 'timestamp unavailable',
  ask: {
    title: 'ASK_EVAL.JSON',
    source: 'scripts/ask-eval.ts',
    url: 'https://github.com/erikunha/portfolio/blob/main/scripts/ask-eval.ts',
    cacheKey: 'ask:eval:latest',
    timestampLabel: 'eval',
    percentUnit: '%',
    latencyUnit: 'ms',
    currencyUnit: '$',
    pending: 'Eval pending. No aggregate is available yet.',
    unavailable: 'Eval unavailable. The aggregate could not be loaded.',
    p95Prefix: '95% of answers finish within',
    p95Pending: '95% of answers finish within this time',
    metrics: [
      {
        key: 'evalPassRate',
        label: 'EVAL PASS-RATE',
        description: 'correctness · factual + edge corpus',
      },
      {
        key: 'jailbreakResistance',
        label: 'JAILBREAK RESIST',
        description: 'prompt-injection refusal rate',
      },
      { key: 'p95LatencyMs', label: 'P95 LATENCY', description: '' },
      {
        key: 'costPerAnswer',
        label: 'COST / ANSWER',
        description: 'production inference · feature model only',
      },
    ],
  },
  psi: {
    title: 'LIVE_PERF.JSON',
    source: 'PSI',
    url: 'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fwww.erikunha.dev%2F',
    timestampLabel: 'psi',
    strategyParameter: 'form_factor',
    outOf: '/100',
    strategies: [
      { key: 'desktop', label: 'DESKTOP' },
      { key: 'mobile', label: 'MOBILE' },
    ],
    metrics: [
      { key: 'performance', label: 'PERFORMANCE' },
      { key: 'accessibility', label: 'ACCESSIBILITY' },
      { key: 'bestPractices', label: 'BEST PRACTICES' },
      { key: 'seo', label: 'SEO' },
    ],
  },
});

export const MEASURED_FORMAT = measured.format;

export function metricTimestamp(iso: string | undefined, staleAfterMs: number) {
  const timestamp = iso ? new Date(iso).getTime() : Number.NaN;
  const valid = Number.isFinite(timestamp);
  return {
    valid,
    label: valid
      ? new Date(timestamp).toISOString().slice(0, MEASURED_FORMAT.dateLength)
      : measured.unknownTimestamp,
    stale: valid && Date.now() - timestamp > staleAfterMs,
  };
}
