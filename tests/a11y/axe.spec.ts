import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('axe-core a11y scan', () => {
  test('homepage has no automatically detectable accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[role="log"]');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .exclude(
        '[data-testid="crt-vignette"], [data-testid="crt-overlay"], [data-testid="crt-mask"], [data-testid="crt-noise"], [data-testid="crt-flicker"], [data-testid="crt-scan-beam"]',
      )
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('contact form error state has no violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="contact-form"]');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .include('[data-testid="contact-form"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
