import { test as base, expect, type Page } from '@playwright/test';
import { installMockBackend } from './mock-backend';

export { expect };

type Fixtures = {
  mockedPage: Page;
};

export const test = base.extend<Fixtures>({
  mockedPage: async ({ page }, use) => {
    await installMockBackend(page, {
      log: 'accept',
      forget: 'happy',
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-name"]', { state: 'attached' });
    await page.waitForSelector('[aria-label="shell command"]', { state: 'visible' });
    await use(page);
  },
});
