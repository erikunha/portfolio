import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
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
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
      testMatch: /tests\/e2e\/(visual|cross-cutting|design-system-components)\.spec\.ts$/,
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
      testMatch: /tests\/e2e\/(visual|cross-cutting|design-system-components)\.spec\.ts$/,
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 14'] },
      testMatch: /tests\/e2e\/(visual|cross-cutting|design-system-components)\.spec\.ts$/,
    },

    // ── Co-located component E2E (testDir: '.', scoped to *.e2e.ts) ─────
    {
      name: 'chromium-components',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      testDir: '.',
      testMatch: /\/(components|app)\/.*\.e2e\.ts$/,
    },
    {
      name: 'chromium-mobile-components',
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
      testDir: '.',
      testMatch: /\/(components|app)\/.*\.e2e\.ts$/,
    },
    {
      name: 'webkit-desktop-components',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
      testDir: '.',
      testMatch: /\/(components|app)\/.*\.e2e\.ts$/,
    },
    {
      name: 'webkit-mobile-components',
      use: { ...devices['iPhone 14'] },
      testDir: '.',
      testMatch: /\/(components|app)\/.*\.e2e\.ts$/,
    },
  ],
});
