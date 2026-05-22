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
    // Force prefers-reduced-motion BEFORE goto so HeroBootAnimation reads
    // `reduce` on mount and appends static dialog lines instead of running
    // its indefinite typewriter loop. Required for toHaveScreenshot stability:
    // without this, the hero section keeps mutating textContent (and on mobile
    // grows in height as lines append), Playwright's two-consecutive-stable-
    // screenshots check never settles, and snapshot regen times out.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    // Wait for the critical above-the-fold content: the hero h1 (RSC, always
    // present once HTML lands) and the shell input (the InteractiveShell
    // island is dynamic({ ssr: false }), so its presence proves the client
    // bundle has hydrated and event handlers are attached).
    await page.waitForSelector('[data-testid="hero-name"]', { state: 'attached' });
    await page.waitForSelector('.shell .shell__input', { state: 'visible' });
    await use(page);
  },
});
