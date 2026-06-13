import ArgosReporter from '@argos-ci/playwright/reporter';
import type { ReporterDescription } from 'playwright/test';
import { defineConfig, devices } from 'playwright/test';

// Playwright's ReporterDescription only allows strings as the first tuple element,
// but it accepts class constructors at runtime. Cast to satisfy the strict type.
const argosEntry = [[ArgosReporter]] as unknown as ReporterDescription[];

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [
    ...(process.env.GITHUB_ACTIONS ? ([['github'], ['list']] as const) : ([['list']] as const)),
    ...(process.env.ARGOS_TOKEN ? argosEntry : []),
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  projects: [
    // ── Existing projects (testDir: './tests', unchanged) ────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      // WHY: CI only — design-system-components has darwin-only baselines; Ubuntu CI
      // would fail with "missing snapshot". Local runs (including baseline regen) are
      // unaffected. Remove once linux baselines are added.
      testIgnore: process.env.CI ? /design-system-components\.spec\.ts/ : [],
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
      testMatch:
        /tests\/(e2e\/(cross-cutting|observability-smoke|design-system-pages)|visual\/visual)\.spec\.ts$/,
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
      testMatch:
        /tests\/(e2e\/(cross-cutting|observability-smoke|design-system-pages)|visual\/visual)\.spec\.ts$/,
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 14'] },
      testMatch:
        /tests\/(e2e\/(cross-cutting|observability-smoke|design-system-pages)|visual\/visual)\.spec\.ts$/,
    },

    // ── Co-located component E2E (testDir: '.', scoped to *.e2e.ts) ─────
    {
      name: 'chromium-components',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      testDir: '.',
      testMatch: /\/(components|design-system\/components|app)\/.*\.e2e\.ts$/,
    },
    // WHY: mobile/webkit component variants are local-only — not in the CI matrix.
    // Add to e2e-functional matrix when responsive component bugs become a gated concern.
    {
      name: 'chromium-mobile-components',
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
      testDir: '.',
      testMatch: /\/(components|design-system\/components|app)\/.*\.e2e\.ts$/,
    },
    {
      name: 'webkit-desktop-components',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
      testDir: '.',
      testMatch: /\/(components|design-system\/components|app)\/.*\.e2e\.ts$/,
    },
    {
      name: 'webkit-mobile-components',
      use: { ...devices['iPhone 14'] },
      testDir: '.',
      testMatch: /\/(components|design-system\/components|app)\/.*\.e2e\.ts$/,
    },
  ],
});
