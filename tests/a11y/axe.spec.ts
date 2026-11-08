import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DS_ROUTES } from '@/app/(en)/design-system/_components/ds-nav';
import { SITE_HTML_LANG, SITE_LOCALE } from '@/content/site-locale';
import { waitForHydration } from '../e2e/_helpers/hydration';
import { revealDeferredContent } from '../e2e/_helpers/snapshot';

const NARROW_VIEWPORT = { width: 390, height: 844 };
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const CRT_OVERLAYS =
  '[data-testid="crt-vignette"], [data-testid="crt-overlay"], [data-testid="crt-mask"], [data-testid="crt-noise"], [data-testid="crt-flicker"], [data-testid="crt-scan-beam"]';
const MENU_TRIGGER = '.mobile-title-bar .menu-trigger';
const COMBOBOX = '[data-testid="contact-timezone"] [role="combobox"]';
const OFFLINE_NOTICE = '.offline-notice';
const COMBOBOX_QUERY = 'a';
const CONTACT_FORM = '[data-testid="contact-form"]';
const TIMEZONE_PANEL = '[data-testid="contact-timezone"]';
const ISLAND_READY_TIMEOUT_MS = 20_000;
const LABEL_IN_NAME_ROUTES = ['/', '/pt', '/cv', '/pt/cv', '/summary', '/links'];
const READING_ROUTES = ['/cv', '/summary', '/pt/cv', '/pt/summary'];
const EXTRA_ROUTES = ['/links', '/links/en', ...READING_ROUTES];
const SCANNED_ROUTES = [...DS_ROUTES, ...EXTRA_ROUTES];
const NARROW_ROUTES = [...DS_ROUTES, ...READING_ROUTES];

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

  for (const route of NARROW_ROUTES) {
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

  test('pt-BR home has no automatically detectable accessibility violations', async ({ page }) => {
    await page.goto('/pt');
    await page.waitForSelector('[role="log"]');
    await revealDeferredContent(page);

    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe(SITE_HTML_LANG[SITE_LOCALE.pt]);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .exclude(
        '[data-testid="crt-vignette"], [data-testid="crt-overlay"], [data-testid="crt-mask"], [data-testid="crt-noise"], [data-testid="crt-flicker"], [data-testid="crt-scan-beam"]',
      )
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('pt-BR CV and summary have no automatically detectable accessibility violations', async ({
    page,
  }) => {
    for (const route of ['/pt/cv', '/pt/summary']) {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations, route).toEqual([]);
    }
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

  test('home at 390 has no violations', async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto('/');
    await page.waitForSelector('[role="log"]');
    await revealDeferredContent(page);
    const results = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .exclude(CRT_OVERLAYS)
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('the open drawer at 390 has no violations', async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto('/');
    await page.locator(MENU_TRIGGER).click();
    await expect(page.locator('.section-menu')).toHaveClass(/is-open/);
    const results = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .exclude(CRT_OVERLAYS)
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('the contact form error state at 390 has no violations', async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto('/');
    await page.locator('#sec-contact').scrollIntoViewIfNeeded();
    await expect(page.locator(CONTACT_FORM)).toBeVisible({ timeout: ISLAND_READY_TIMEOUT_MS });
    await waitForHydration(page, CONTACT_FORM);
    await page.locator(`${CONTACT_FORM} button[type="submit"]`).click();
    await expect(page.locator('.contact-alert')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include(CONTACT_FORM)
      .withTags(AXE_TAGS)
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('the open timezone combobox has no violations', async ({ page }) => {
    await page.goto('/');
    await page.locator('.contact-timezone').scrollIntoViewIfNeeded();
    await expect(page.locator(TIMEZONE_PANEL)).toBeVisible({ timeout: ISLAND_READY_TIMEOUT_MS });
    const combobox = page.locator(COMBOBOX);
    await combobox.click();
    await combobox.pressSequentially(COMBOBOX_QUERY);
    await expect(combobox).toHaveAttribute('aria-expanded', 'true');
    const results = await new AxeBuilder({ page })
      .include(TIMEZONE_PANEL)
      .withTags(AXE_TAGS)
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('the offline notice has no violations', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);
    await expect(page.locator(OFFLINE_NOTICE)).toContainText('NO SIGNAL');
    const results = await new AxeBuilder({ page })
      .include(OFFLINE_NOTICE)
      .withTags(AXE_TAGS)
      .analyze();
    expect(results.violations).toEqual([]);
    await context.setOffline(false);
  });

  for (const route of LABEL_IN_NAME_ROUTES) {
    test(`${route} names every control with its visible label (WCAG 2.5.3)`, async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withRules(['label-content-name-mismatch'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
