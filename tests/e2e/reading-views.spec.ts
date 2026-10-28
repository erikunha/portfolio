import { expect, test } from '@playwright/test';
import { careerCopy } from '../../content/git-log';
import { profile } from '../../content/profile';
import { READING_PATHS, readingViews } from '../../content/reading-views';
import { installMockBackend } from './_helpers/mock-backend';

test.describe('reading views', () => {
  test('/cv renders the document with a working print button', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { printCalls: number };
      w.printCalls = 0;
      window.print = () => {
        w.printCalls += 1;
      };
    });
    await page.goto(READING_PATHS.cv);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(profile.displayName);
    await expect(
      page.getByRole('heading', { level: 2, name: readingViews.cv.headings.experience }),
    ).toBeVisible();
    const print = page.getByRole('button', { name: readingViews.shared.printLabel });
    await expect(print).toBeVisible();
    await print.click();
    expect(
      await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls),
    ).toBe(1);
  });

  test('/cv print layout drops the site chrome and shows link URLs', async ({ page }) => {
    await page.goto(READING_PATHS.cv);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.reading-bar')).toBeHidden();
    await expect(page.locator('.reading-actions')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const linkedin = page.locator('.reading-links a', { hasText: 'LinkedIn' });
    const after = await linkedin.evaluate((node) => getComputedStyle(node, '::after').content);
    expect(after).toContain('linkedin.com');
  });

  test('/summary renders stats, projects and a print button', async ({ page }) => {
    await page.goto(READING_PATHS.summary);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(profile.displayName);
    await expect(page.locator('.reading-stats .stat-tile')).toHaveCount(4);
    await expect(page.locator('.reading-projects > li')).toHaveCount(
      readingViews.summary.projectNames.length,
    );
    await expect(page.getByRole('button', { name: readingViews.shared.printLabel })).toBeVisible();
    await page.getByRole('link', { name: readingViews.summary.cvLinkLabel }).click();
    await page.waitForURL(`**${READING_PATHS.cv}`);
  });

  test('the Career CV link lands on /cv', async ({ page }) => {
    await installMockBackend(page, { log: 'accept' });
    await page.goto('/');
    const link = page.locator('a.career-cv');
    await link.scrollIntoViewIfNeeded();
    await expect(link).toHaveText(careerCopy.cvLabel);
    await link.click();
    await page.waitForURL(`**${READING_PATHS.cv}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(profile.displayName);
  });
});
