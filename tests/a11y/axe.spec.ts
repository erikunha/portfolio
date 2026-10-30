import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DS_ROUTES } from '@/app/design-system/_components/ds-nav';
import { revealDeferredContent } from '../e2e/_helpers/snapshot';

const NARROW_VIEWPORT = { width: 390, height: 844 };
const EXTRA_ROUTES = ['/links', '/links/en'];
const SCANNED_ROUTES = [...DS_ROUTES, ...EXTRA_ROUTES];

test.describe('axe-core a11y scan', () => {
  for (const route of SCANNED_ROUTES) {
    test(`${route} has no automatically detectable accessibility violations`, async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  for (const route of DS_ROUTES) {
    test(`${route} has no violations at 390`, async ({ page }) => {
      await page.setViewportSize(NARROW_VIEWPORT);
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('homepage has no automatically detectable accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[role="log"]');
    await revealDeferredContent(page);

    const unpainted = await page.evaluate(() =>
      Array.from(document.querySelectorAll('section.module-deferred'))
        .filter((el) => getComputedStyle(el).contentVisibility !== 'visible')
        .map((el) => el.id),
    );
    expect(
      unpainted,
      'the homepage scan must audit the painted page. A content-visibility: auto module keeps its 520px placeholder box while its content is laid out at full height, so an unpainted module lays its rows over the next section and axe reads the green send button as the backdrop of the mixer badge (1.27:1), a backdrop no visitor ever sees. Reveal the deferred modules first, as the visual baselines do.',
    ).toEqual([]);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
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
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
