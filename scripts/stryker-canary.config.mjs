import base from '../stryker.config.mjs';

export const CANARY_FILE = 'lib/links/relative-time.ts';
export const CANARY_REPORT_ENV = 'STRYKER_CANARY_REPORT';

export default {
  ...base,
  mutate: [CANARY_FILE],
  incremental: false,
  reporters: ['json'],
  jsonReporter: { fileName: process.env[CANARY_REPORT_ENV] ?? 'mutation-canary.json' },
  thresholds: { ...base.thresholds, break: null },
};
