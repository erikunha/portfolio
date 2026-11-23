import { test as base } from '@playwright/test';
import { createStallGuard } from './navigation-stall';

export * from '@playwright/test';

const guard = createStallGuard({
  browserName: (page) => page.context().browser()?.browserType().name(),
  testInfo: () => base.info(),
  now: () => Date.now(),
});

export const { guardBrowser, guardContext, guardNavigation } = guard;

export const test = base.extend(guard.fixtures);
