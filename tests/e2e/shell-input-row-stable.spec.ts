import { expect, type Page, test } from '@playwright/test';
import { settleFrames } from './_helpers/geometry';
import { installChunkedAsk } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR } from './_helpers/shell';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;
const REQUEST_ID = '3f1c9a2e-7b44-4d0a-9c1e-5a8d2b6f0e71';
const CHUNK = 'Erik builds agent platforms, eval harnesses and guardrails for production systems. ';
const CHUNKS = 8;

function formTop(page: Page): Promise<number> {
  return page
    .locator(SHELL_SELECTOR.form)
    .evaluate((node) => Math.round(node.getBoundingClientRect().top + window.scrollY));
}

for (const viewport of VIEWPORTS) {
  test(`at ${viewport.width}px the input row stays put from send to answered`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await freezeMotion(page);
    const chunked = await installChunkedAsk(page, { requestId: REQUEST_ID });
    await openShell(page);
    await settleFrames(page);
    const idle = await formTop(page);

    await askShell(page, 'who is erik?');
    await expect.poll(chunked.requests).toBe(1);
    await settleFrames(page);
    const tops: Record<string, number> = { thinking: await formTop(page) };

    for (let index = 0; index < CHUNKS; index++) {
      await chunked.push(CHUNK);
      await settleFrames(page);
      tops[`chunk ${index + 1}`] = await formTop(page);
    }
    await chunked.end();
    await expect(page.locator(SHELL_SELECTOR.receipt)).toBeVisible();
    await settleFrames(page);
    tops.answered = await formTop(page);

    for (const [stage, top] of Object.entries(tops)) {
      expect(top, `the input row moved while ${stage}`).toBe(idle);
    }
  });
}
