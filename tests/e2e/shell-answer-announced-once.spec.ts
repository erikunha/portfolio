import { expect, type Page, test } from '@playwright/test';
import { SITE_LOCALE, type SiteLocale } from '../../content/site-locale';
import { installChunkedAsk } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR, shellCopy } from './_helpers/shell';

const QUESTION = 'what does Erik build?';
const FIRST_CHUNK = 'Erik builds agent ';
const SECOND_CHUNK = 'platforms and eval harnesses.';
const ANSWER = `${FIRST_CHUNK}${SECOND_CHUNK}`;

type Variant = { name: string; locale: SiteLocale; path: string; motionOff: boolean };

const VARIANTS: readonly Variant[] = [
  { name: 'MOTION off', locale: SITE_LOCALE.en, path: '/', motionOff: true },
  { name: 'MOTION on', locale: SITE_LOCALE.en, path: '/', motionOff: false },
  { name: 'Portuguese', locale: SITE_LOCALE.pt, path: '/pt', motionOff: true },
];

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

async function logTree(page: Page): Promise<string> {
  return page.locator(SHELL_SELECTOR.feed).ariaSnapshot();
}

for (const { name, locale, path, motionOff } of VARIANTS) {
  test.describe(`the streamed answer reaches the accessibility tree once (${name})`, {
    tag: '@cross-browser',
  }, () => {
    const { ui } = shellCopy(locale);

    test('is hidden from the tree while it streams, then added whole when it settles', async ({
      page,
    }, testInfo) => {
      if (motionOff) await freezeMotion(page);
      const chunked = await installChunkedAsk(page);
      await openShell(page, path);
      await askShell(page, QUESTION);
      await expect.poll(chunked.requests).toBe(1);

      await chunked.push(FIRST_CHUNK);
      await expect(page.locator(SHELL_SELECTOR.output).last()).toContainText(FIRST_CHUNK.trim());
      await expect(page.locator(SHELL_SELECTOR.caret)).toBeVisible();
      const heldFirst = await logTree(page);
      await testInfo.attach('tree-held-first-chunk', { body: heldFirst });
      expect(heldFirst, 'in-flight text must stay out of the tree').not.toContain(
        FIRST_CHUNK.trim(),
      );

      await chunked.push(SECOND_CHUNK);
      await expect(page.locator(SHELL_SELECTOR.output).last()).toContainText(SECOND_CHUNK);
      const heldSecond = await logTree(page);
      await testInfo.attach('tree-held-second-chunk', { body: heldSecond });
      expect(heldSecond).not.toContain(SECOND_CHUNK);

      await chunked.end();
      await expect(page.locator(SHELL_SELECTOR.caret)).toHaveCount(0);
      const settled = await logTree(page);
      await testInfo.attach('tree-settled', { body: settled });
      expect(occurrences(settled, ANSWER), 'the finished answer enters the tree once').toBe(1);
      expect(settled).toContain(`${ui.aiLabel}: ${ANSWER}`);
    });
  });
}
