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
    // Default project: all existing smoke + a11y tests run here unchanged.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    // New matrix projects — scoped via testMatch to the four new spec files only.
    // Without testMatch these projects would also run the existing a11y + observability
    // smoke specs, tripling CI minutes and likely failing on WebKit.
    {
      name: 'chromium-mobile',
      // Override defaultBrowserType: devices['iPhone SE'] sets it to 'webkit',
      // but this project intentionally tests Chromium with a mobile viewport.
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
      testMatch:
        /tests\/e2e\/(contact|ask|visual|cross-cutting|design-system-components)\.spec\.ts$/,
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
      testMatch:
        /tests\/e2e\/(contact|ask|visual|cross-cutting|design-system-components)\.spec\.ts$/,
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 14'] },
      testMatch:
        /tests\/e2e\/(contact|ask|visual|cross-cutting|design-system-components)\.spec\.ts$/,
    },
  ],
});
