import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.GITHUB_ACTIONS ? [['github'], ['list']] : 'list',
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
      // WHY: design-system-components has toHaveScreenshot assertions with darwin-only
      // baselines — running on Ubuntu CI fails with "missing snapshot". Remove this
      // ignore once linux baselines are added (move spec to tests/visual/ at that point).
      testIgnore: /design-system-components\.spec\.ts/,
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
      testMatch: /tests\/(e2e\/cross-cutting|visual\/visual)\.spec\.ts$/,
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
      testMatch: /tests\/(e2e\/cross-cutting|visual\/visual)\.spec\.ts$/,
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 14'] },
      testMatch: /tests\/(e2e\/cross-cutting|visual\/visual)\.spec\.ts$/,
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
