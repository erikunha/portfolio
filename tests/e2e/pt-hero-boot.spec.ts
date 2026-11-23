import { heroClientContent } from '../../content/hero-client';
import { SITE_LOCALE } from '../../content/site-locale';
import { VIEWPORTS, WIDTH } from './_helpers/geometry';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';
import { expect, test } from './_helpers/test';

const DESKTOP = { width: WIDTH.DESKTOP, height: 800 };
const NARROW = { width: WIDTH.PHONE_NARROW, height: 720 };
const PHONE = VIEWPORTS.PHONE;
const SINGLE_LINE_FACTOR = 1.6;

const LOCALES = [
  { path: '/', locale: SITE_LOCALE.en },
  { path: '/pt', locale: SITE_LOCALE.pt },
] as const;

for (const { path, locale } of LOCALES) {
  const copy = heroClientContent[locale];

  test(`${path} desktop boot log is written in ${locale}`, { tag: '@cross-browser' }, async ({
    page,
  }) => {
    await freezeMotion(page);
    await page.setViewportSize(DESKTOP);
    await gotoSettled(page, path);
    const log = page.locator('.hero-boot-desktop');
    await expect(log).toContainText(copy.bootSequenceLine);
    for (const step of copy.bootSteps) await expect(log).toContainText(step.label);
    await expect(log).toContainText(copy.bootWelcome);
    await expect(log).toContainText(copy.bootStaticDialogLine);
    await expect(log).toContainText(copy.bootCommand);
  });

  for (const viewport of [PHONE, NARROW]) {
    test(`${path} mobile boot log is written in ${locale} on one line each at ${viewport.width}`, {
      tag: '@cross-browser',
    }, async ({ page }) => {
      await freezeMotion(page);
      await page.setViewportSize(viewport);
      await gotoSettled(page, path);
      const lines = page.locator('.hero-boot-mobile [data-testid="boot-line"]');
      await expect(lines.nth(0)).toHaveText(copy.bootSequenceLine);
      await expect(lines.nth(1)).toContainText(copy.bootCommand);
      await expect(lines.nth(2)).toContainText(copy.bootStaticDialogLine);
      const wrapped = await lines.evaluateAll(
        (nodes, factor) =>
          nodes
            .filter((node) => {
              const style = getComputedStyle(node);
              return (
                node.getBoundingClientRect().height > Number.parseFloat(style.lineHeight) * factor
              );
            })
            .map((node) => node.textContent),
        SINGLE_LINE_FACTOR,
      );
      expect(wrapped, 'a boot line that wraps pushes the hero below the fold').toEqual([]);
    });
  }
}

test('/pt shows the system failure plate in Portuguese', { tag: '@cross-browser' }, async ({
  page,
}) => {
  await freezeMotion(page);
  await page.setViewportSize(DESKTOP);
  await gotoSettled(page, '/pt');
  await expect(page.locator('.sysfail-plate')).toHaveText(
    heroClientContent[SITE_LOCALE.pt].systemFailurePlate,
  );
});
