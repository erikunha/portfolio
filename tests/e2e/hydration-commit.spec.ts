import { expect, test } from '@playwright/test';
import { MOTION_BODY_STATE } from '@/lib/motion-change';
import { waitForHydration } from './_helpers/hydration';
import { freezeMotion } from './_helpers/motion';
import { installCommitOracle, isNodeCommitted } from './_helpers/react-commit-oracle';

const CPU_THROTTLE_RATE = 10;
const TEST_BUDGET_MS = 180_000;
const ISLANDS = [
  { name: 'contact form', selector: '[data-testid="contact-form"]' },
  { name: 'interactive shell', selector: '[data-testid="shell-form"]' },
] as const;

test.describe('waitForHydration returns only once React committed the island', () => {
  test.setTimeout(TEST_BUDGET_MS);

  for (const island of ISLANDS) {
    test(`the ${island.name} is in the committed tree when the wait returns`, async ({ page }) => {
      await freezeMotion(page);
      await installCommitOracle(page);
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE_RATE });
      await page.goto('/');
      await expect(
        page.locator('body'),
        'the matrix rain is still animating: its frames compete with the throttled hydration and stretch the test past its budget',
      ).toHaveAttribute('data-motion', MOTION_BODY_STATE.reduce);
      await page.locator(island.selector).scrollIntoViewIfNeeded();
      await waitForHydration(page, island.selector);
      expect(
        await isNodeCommitted(page, island.selector),
        'React had started hydrating the node but had not committed it: its handlers are not attached',
      ).toBe(true);
    });
  }
});
