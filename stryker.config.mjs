// @ts-check
export default {
  packageManager: 'pnpm',
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  coverageAnalysis: 'perTest',
  incremental: true,
  incrementalFile: '.stryker-incremental.json',
  mutate: [
    'app/api/**/*.ts',
    'lib/**/*.ts',
    '!**/*.test.*',
    '!**/*.spec.*',
    '!**/index.ts',
    '!design-system/dist/**',
  ],
  thresholds: {
    high: 80,
    low: 65,
    break: 65,
  },
  reporters: ['html', 'clear-text', 'json'],
  htmlReporter: { fileName: 'mutation-report.html' },
  jsonReporter: { fileName: 'mutation-report.json' },
  timeoutMS: 10000,
  timeoutFactor: 2,
};
