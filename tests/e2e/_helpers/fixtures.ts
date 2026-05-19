// tests/e2e/_helpers/fixtures.ts
//
// Extended Playwright test fixture that provides `mockedPage`: a page with all
// backend mocks installed (log routes silently accepted by default) and
// navigated to '/'. Ready for UI assertions and screenshots without per-test
// setup boilerplate.
//
// Import `test` from this file instead of '@playwright/test' to get the fixture:
//
//   import { test, expect } from './_helpers/fixtures';
//   test('hero renders', async ({ mockedPage }) => { ... });
//
// `expect` is re-exported unchanged so specs can do a single import.

import { test as base, expect, type Page } from '@playwright/test';
import { installMockBackend } from './mock-backend';

export { expect };

type Fixtures = {
  mockedPage: Page;
};

export const test = base.extend<Fixtures>({
  mockedPage: async ({ page }, use) => {
    // Install mocks before navigation so no real API call escapes.
    await installMockBackend(page, {
      log: 'accept',
      forget: 'happy',
    });
    await page.goto('/');
    // Wait for the critical above-the-fold content: the hero h1 and the shell.
    await page.waitForSelector('h1.hero__name', { state: 'attached' });
    await use(page);
  },
});
