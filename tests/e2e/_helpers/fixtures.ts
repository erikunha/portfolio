import { test as base, expect, type Page } from '@playwright/test';
import { installMockBackend } from './mock-backend';
import { freezeMotion } from './motion';

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
    await freezeMotion(page);
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-name"]', { state: 'attached' });
    await page.waitForSelector('[aria-label="shell command"]', { state: 'visible' });
    await use(page);
  },
});
