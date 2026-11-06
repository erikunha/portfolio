import { expect, test } from '@playwright/test';
import { waitForHydration } from './_helpers/hydration';
import { installMockBackend } from './_helpers/mock-backend';

const HYDRATION_DELAY_MS = 2000;
const SHELL_FORM_SELECTOR = '[data-testid="shell-form"]';
const SHELL_INPUT_SELECTOR = '[aria-label="shell command"]';
const TYPED_COMMAND = 'help me';

test.describe('shell input before it hydrates', () => {
  test('a command typed while the scripts load survives hydration and runs', async ({ page }) => {
    await installMockBackend(page, { ask: 'happy', log: 'accept' });
    await page.route('**/_next/static/chunks/**/*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, HYDRATION_DELAY_MS));
      await route.continue();
    });
    await page.goto('/', { waitUntil: 'commit' });
    const input = page.locator(SHELL_INPUT_SELECTOR);
    await input.waitFor({ state: 'attached' });
    await input.scrollIntoViewIfNeeded();
    await input.pressSequentially(TYPED_COMMAND);
    await waitForHydration(page, SHELL_FORM_SELECTOR);

    await expect(input, 'the command typed before hydration is still in the input').toHaveValue(
      TYPED_COMMAND,
    );
    await input.press('Enter');
    await expect(page.getByRole('log').first()).toContainText(TYPED_COMMAND);
    await expect(input).toHaveValue('');
  });
});
