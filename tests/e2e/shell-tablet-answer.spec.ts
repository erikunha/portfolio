import { expect, test } from '@playwright/test';
import { horizontalOverflow, settleFrames, VIEWPORTS } from './_helpers/geometry';
import { installChunkedAsk } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR } from './_helpers/shell';

const QUESTION = 'what does Erik build?';
const PARTIAL = 'Erik builds agent platforms';
const REST = ' and eval harnesses.';

test.use({ viewport: VIEWPORTS.TABLET });

test('at 768px the shell goes from thinking to answered without overflow or a height change', async ({
  page,
}) => {
  await freezeMotion(page);
  const chunked = await installChunkedAsk(page);
  await openShell(page);
  await settleFrames(page);
  const section = page.locator(SHELL_SELECTOR.section);
  const heightOf = () => section.evaluate((node) => node.getBoundingClientRect().height);
  const idle = await heightOf();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await askShell(page, QUESTION);
  await expect.poll(chunked.requests).toBe(1);
  await expect(page.locator(SHELL_SELECTOR.loading)).toBeVisible();
  await settleFrames(page);
  expect(await heightOf(), 'thinking').toBe(idle);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await chunked.push(PARTIAL);
  await expect(page.locator(SHELL_SELECTOR.output).last()).toContainText(PARTIAL);
  await expect(page.locator(SHELL_SELECTOR.loading)).toHaveCount(0);
  await settleFrames(page);
  expect(await heightOf(), 'streaming').toBe(idle);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await chunked.push(REST);
  await chunked.end();
  await expect(page.locator(SHELL_SELECTOR.reference)).toBeVisible();
  await expect(page.locator(SHELL_SELECTOR.feed)).toHaveAttribute('aria-busy', 'false');
  await settleFrames(page);
  expect(await heightOf(), 'answered').toBe(idle);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});
