import { expect, type Page, test } from '@playwright/test';
import { gitLog } from '../../content/git-log';
import { profile } from '../../content/profile';
import { READING_PATHS } from '../../content/reading-views';
import { SITE_LOCALE } from '../../content/site-locale';

const TOUCH_TARGET_PX = 28;
const NEIGHBOUR_CLEARANCE_PX = 14;
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
];

async function probeHitArea(page: Page, selector: string, index: number) {
  return page.evaluate(
    ({ selector: sel, index: i, target, clearance }) => {
      const link = document.querySelectorAll<HTMLAnchorElement>(sel)[i];
      if (!link)
        return { found: false, top: false, bottom: false, stealsAbove: false, stealsBelow: false };
      link.scrollIntoView({ block: 'center' });
      const rect = link.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const hits = (y: number) => document.elementFromPoint(x, y)?.closest('a') === link;
      const centreY = rect.top + rect.height / 2;
      return {
        found: true,
        top: hits(centreY - target / 2 + 1),
        bottom: hits(centreY + target / 2 - 1),
        stealsAbove: hits(rect.top - clearance),
        stealsBelow: hits(rect.bottom + clearance),
      };
    },
    { selector, index, target: TOUCH_TARGET_PX, clearance: NEIGHBOUR_CLEARANCE_PX },
  );
}

test.describe('career company links', () => {
  for (const viewport of VIEWPORTS) {
    test(`home career log links every company at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      const links = page.locator('[data-testid="career-log"] a.company-link');
      await expect(links).toHaveCount(gitLog[SITE_LOCALE.en].length);
      for (const [index, job] of gitLog[SITE_LOCALE.en].entries()) {
        const link = links.nth(index);
        await expect(link).toHaveAttribute('href', job.companyUrl);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        const hit = await probeHitArea(page, '[data-testid="career-log"] a.company-link', index);
        expect(
          hit,
          `${job.company} must expose a ${TOUCH_TARGET_PX}px tap target without covering the lines around it`,
        ).toEqual({
          found: true,
          top: true,
          bottom: true,
          stealsAbove: false,
          stealsBelow: false,
        });
      }
    });
  }

  test('company links show a visible focus ring when reached by keyboard', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const link = page.locator('[data-testid="career-log"] a.company-link').first();
    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    const outline = await link.evaluate((el) => {
      const style = getComputedStyle(el);
      return { width: Number.parseFloat(style.outlineWidth), style: style.outlineStyle };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThan(0);
  });

  test('the hero links the current employer', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const link = page.locator('[data-testid="hero-desktop"] .hero-context-fact--employer a');
    await expect(link).toHaveAttribute('href', profile.currentEmployer.url);
  });

  test('/cv links every employer and prints the company URL', async ({ page }) => {
    await page.goto(READING_PATHS.cv);
    const links = page.locator('section[aria-labelledby="cv-experience"] article h3 a');
    await expect(links).toHaveCount(gitLog[SITE_LOCALE.en].length);
    for (const [index, job] of gitLog[SITE_LOCALE.en].entries()) {
      await expect(links.nth(index)).toHaveAttribute('href', job.companyUrl);
    }
    await page.emulateMedia({ media: 'print' });
    const printed = await links.first().evaluate((el) => getComputedStyle(el, '::after').content);
    expect(printed).toContain(gitLog[SITE_LOCALE.en][0]?.companyUrl);
  });

  test('/summary links the current employer', async ({ page }) => {
    await page.goto(READING_PATHS.summary);
    await expect(page.locator('.reading-meta a')).toHaveAttribute(
      'href',
      profile.currentEmployer.url,
    );
  });
});
