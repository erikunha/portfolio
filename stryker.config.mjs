// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'pnpm',
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  mutate: [
    // API routes and server logic are the highest-value mutation targets:
    // bugs here are security/correctness issues, not just UI regressions.
    'app/api/**/*.ts',
    'lib/**/*.ts',
    'scripts/**/*.ts',
    // Exclude test files, type-only files, and generated output.
    '!**/*.test.*',
    '!**/*.spec.*',
    '!**/index.ts',
    '!design-system/dist/**',
  ],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  reporters: ['html', 'clear-text', 'json'],
  htmlReporter: { fileName: 'mutation-report.html' },
  jsonReporter: { fileName: 'mutation-report.json' },
  timeoutMS: 10000,
  timeoutFactor: 2,
};
