// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'pnpm',
  testRunner: 'vitest',
  // WHY: Stryker's default plugin discovery glob ('@stryker-mutator/*') does not
  // resolve the .pnpm-symlinked vitest-runner in its worker process, so the runner
  // silently fails to load ("Cannot find TestRunner plugin vitest") and the weekly
  // job produced zero signal (masked by continue-on-error). Naming the plugin
  // explicitly makes discovery deterministic under pnpm. See DECISIONS.md.
  plugins: ['@stryker-mutator/vitest-runner'],
  coverageAnalysis: 'perTest',
  // Incremental mode: re-test only mutants in files changed since the last run,
  // reusing cached statuses for the rest. The report stays complete (cached +
  // fresh), so the score, the de-masking guard, and the trend signal are unchanged.
  // incrementalFile is pinned to repo root (Stryker's default is
  // reports/stryker-incremental.json) so the config, the actions/cache path, and
  // .gitignore all reference the same file. CI caches it across weekly runs.
  incremental: true,
  incrementalFile: '.stryker-incremental.json',
  mutate: [
    // API routes and server logic are the highest-value mutation targets:
    // bugs here are security/correctness issues, not just UI regressions.
    'app/api/**/*.ts',
    'lib/**/*.ts',
    // Exclude test files, type-only files, and generated output.
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
