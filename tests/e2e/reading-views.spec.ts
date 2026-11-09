import { expect, test } from '@playwright/test';
import { careerCopy } from '../../content/git-log';
import { heroContent } from '../../content/hero';
import { profile } from '../../content/profile';
import { READING_PATHS, readingViews } from '../../content/reading-views';
import { SITE_LOCALE } from '../../content/site-locale';
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
      page.getByRole('heading', {
        level: 2,
        name: readingViews[SITE_LOCALE.en].cv.headings.experience,
      }),
    ).toBeVisible();
    const print = page.getByRole('button', {
      name: readingViews[SITE_LOCALE.en].shared.printLabel,
    });
    await expect(print).toBeVisible();
    await print.click();
    expect(
      await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls),
    ).toBe(1);
  });

  test('/cv print layout drops the site chrome and shows link URLs', async ({ page }) => {
    await page.goto(READING_PATHS.cv);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.desktop-topbar')).toBeHidden();
    await expect(page.locator('.mobile-title-bar')).toBeHidden();
    await expect(page.locator('.reading-actions')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const linkedin = page.locator('.reading-links a', { hasText: 'LinkedIn' });
    const after = await linkedin.evaluate((node) => getComputedStyle(node, '::after').content);
    expect(after).toContain('linkedin.com');
  });

  test('/summary renders stats, projects and a print button', async ({ page }) => {
    await page.goto(READING_PATHS.summary);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(profile.displayName);
    await expect(page.locator('.reading-stats .stat-tile')).toHaveCount(
      heroContent[SITE_LOCALE.en].stats.length,
    );
    await expect(page.locator('.reading-projects > li')).toHaveCount(
      readingViews[SITE_LOCALE.en].summary.projectNames.length,
    );
    await expect(
      page.getByRole('button', { name: readingViews[SITE_LOCALE.en].shared.printLabel }),
    ).toBeVisible();
    await page
      .locator('main#main-content')
      .getByRole('link', { name: readingViews[SITE_LOCALE.en].summary.cvLinkLabel })
      .click();
    await page.waitForURL(`**${READING_PATHS.cv}`);
  });

  test('the Career CV link lands on /cv', async ({ page }) => {
    await installMockBackend(page, { log: 'accept' });
    await page.goto('/');
    const link = page.locator('a.career-cv');
    await link.scrollIntoViewIfNeeded();
    await expect(link).toHaveText(careerCopy[SITE_LOCALE.en].cvLabel);
    await link.click();
    await page.waitForURL(`**${READING_PATHS.cv}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(profile.displayName);
  });

  for (const path of [READING_PATHS.cv, READING_PATHS.summary]) {
    test(`${path} paints the matrix rain behind the reading content`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('canvas'), 'the reading views carry the global rain').toHaveCount(
        1,
      );
      const probe = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) canvas.style.pointerEvents = 'auto';
        const heading = document.querySelector('h1');
        if (!heading) return null;
        const box = heading.getBoundingClientRect();
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return { insideHeading: heading.contains(top), tag: top?.tagName ?? '' };
      });
      expect(probe, 'the reading view owns a heading').not.toBeNull();
      expect(
        probe?.insideHeading,
        'the rain paints over the heading, the reading view must stack above it',
      ).toBe(true);
      expect(probe?.tag).not.toBe('CANVAS');
    });
  }
});
