import { expect, type Page, test } from '@playwright/test';
import { STREAM_ERR_SENTINEL } from '../../lib/stream-protocol';
import { installChunkedAsk } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR, shellCopy, stopButton } from './_helpers/shell';

const { ui } = shellCopy();
const QUESTION = 'what does Erik build?';
const PARTIAL = 'Erik builds agent';
const FAILURE = 'upstream broke';

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

async function openHeldPartial(page: Page) {
  await freezeMotion(page);
  const chunked = await installChunkedAsk(page);
  await openShell(page);
  await askShell(page, QUESTION);
  await expect.poll(chunked.requests).toBe(1);
  await chunked.push(PARTIAL);
  await expect(page.locator(SHELL_SELECTOR.output).last()).toContainText(PARTIAL);
  await expect(page.locator(SHELL_SELECTOR.caret)).toBeVisible();
  return chunked;
}

test.describe('a partial answer that ends early reaches the accessibility tree once', {
  tag: '@cross-browser',
}, () => {
  test('stopped mid-stream, the partial text is in the tree once with the stop notice', async ({
    page,
  }, testInfo) => {
    await openHeldPartial(page);
    await stopButton(page).click();
    await expect(page.locator(SHELL_SELECTOR.caret)).toHaveCount(0);
    const tree = await page.locator(SHELL_SELECTOR.feed).ariaSnapshot();
    await testInfo.attach('tree-after-stop', { body: tree });
    expect(occurrences(tree, PARTIAL)).toBe(1);
    expect(tree).toContain(`${ui.aiLabel}: ${PARTIAL}`);
    expect(tree).toContain(ui.stoppedPartial);
  });

  test('cut by an error sentinel, the partial text is in the tree once beside the error', async ({
    page,
  }, testInfo) => {
    const chunked = await openHeldPartial(page);
    await chunked.push(`${STREAM_ERR_SENTINEL}${FAILURE}`);
    await chunked.end();
    await expect(page.locator(SHELL_SELECTOR.caret)).toHaveCount(0);
    const tree = await page.locator(SHELL_SELECTOR.feed).ariaSnapshot();
    await testInfo.attach('tree-after-error', { body: tree });
    expect(occurrences(tree, PARTIAL)).toBe(1);
    expect(tree).toContain(`${ui.aiLabel}: ${PARTIAL}`);
    expect(tree).toContain(FAILURE);
    expect(tree).not.toContain(STREAM_ERR_SENTINEL);
  });
});
