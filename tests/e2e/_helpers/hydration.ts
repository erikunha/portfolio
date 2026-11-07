import type { Page } from '@playwright/test';

const REACT_FIBER_KEY_PREFIX = '__reactFiber$';

export async function waitForHydration(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(
    ([target, prefix]) => {
      const node = document.querySelector(target);
      return node !== null && Object.keys(node).some((key) => key.startsWith(prefix));
    },
    [selector, REACT_FIBER_KEY_PREFIX] as const,
  );
}
