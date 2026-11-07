import type { BrowserContext, Page } from '@playwright/test';

export async function drainRoutes(target: Page | BrowserContext): Promise<void> {
  await target.unrouteAll({ behavior: 'wait' });
}
