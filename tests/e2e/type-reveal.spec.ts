import { expect, test } from '@playwright/test';
import { gotoHydrated, MOTION_TOPBAR_TOGGLE } from './_helpers/hydration';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';

const MARKED = '[data-type-reveal]';
const TYPING_TIMEOUT_MS = 20_000;

test.describe('type reveal', () => {
  test('a marked heading types in once it scrolls into view', async ({ page }) => {
    await gotoSettled(page, '/');
    await page.waitForFunction(() =>
      document.documentElement.classList.contains('type-reveal-ready'),
    );

    const belowFold = await page
      .locator(MARKED)
      .evaluateAll((els) =>
        els.findIndex((el) => el.getBoundingClientRect().top > window.innerHeight * 1.5),
      );
    expect(
      belowFold,
      'the reveal can only be observed on a marked element that starts well below the fold',
    ).toBeGreaterThanOrEqual(0);
    const heading = page.locator(MARKED).nth(belowFold);
    await expect(heading).not.toHaveClass(/is-typed/);
    const clipBefore = await heading.evaluate((el) => getComputedStyle(el).clipPath);
    expect(clipBefore).toContain('inset');

    await heading.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(heading).toHaveClass(/is-typed/);
    await expect
      .poll(
        () =>
          heading.evaluate((el) => getComputedStyle(el).getPropertyValue('--type-progress').trim()),
        { timeout: TYPING_TIMEOUT_MS },
      )
      .toBe('1');
    expect(Number(await heading.evaluate((el) => el.style.getPropertyValue('--type-chars')))).toBe(
      ((await heading.textContent()) ?? '').trim().length,
    );
  });

  test('turning motion off and on again never replays the typing animation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoHydrated(page, '/', MOTION_TOPBAR_TOGGLE);
    await page.waitForFunction(() =>
      document.documentElement.classList.contains('type-reveal-ready'),
    );
    const motion = page.getByRole('button', { name: /motion/i }).first();
    await motion.click();
    await expect(page.locator('body')).toHaveAttribute('data-motion', 'reduce');
    await motion.click();
    await expect(page.locator('body')).not.toHaveAttribute('data-motion', 'reduce');

    const statics = page.locator(`${MARKED}.is-static`);
    expect(
      await statics.count(),
      'turning motion off must mark every untyped element static',
    ).toBeGreaterThan(0);
    const styles = await statics.evaluateAll((els) =>
      els.map((el) => {
        const style = getComputedStyle(el);
        return { animation: style.animationName, clip: style.clipPath };
      }),
    );
    for (const style of styles) {
      expect(
        style,
        'a static element must not type in again when motion returns; if this fails, a typing rule matches .is-static',
      ).toEqual({ animation: 'none', clip: 'none' });
    }
  });

  test('with reduced motion every marked element is fully visible at load', async ({ page }) => {
    await freezeMotion(page);
    await gotoSettled(page, '/');
    await page.waitForFunction(() =>
      document.documentElement.classList.contains('type-reveal-ready'),
    );

    const clips = await page
      .locator('[data-type-reveal]')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).clipPath));
    expect(clips.length).toBeGreaterThan(0);
    expect(clips.every((clip) => clip === 'none')).toBe(true);
  });

  const NARROW_WIDTHS = [320, 375];
  const ROUTES = ['/', '/cv', '/summary', '/links'];
  const routeWidths = ROUTES.flatMap((route) => NARROW_WIDTHS.map((width) => ({ route, width })));
  for (const { route, width } of routeWidths) {
    test(`marked elements on ${route} at ${width}px hold only typed text and stay on one line`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      await gotoSettled(page, route);
      await page.waitForFunction(() =>
        document.documentElement.classList.contains('type-reveal-ready'),
      );

      await page.addStyleTag({
        content: '.module-deferred { content-visibility: visible !important; }',
      });
      const marked = page.locator('[data-type-reveal]');
      await expect(marked).not.toHaveCount(0);
      const offenders = await marked.evaluateAll((els) =>
        els
          .filter((el) => {
            const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
            const wraps = el.getClientRects().length > 1;
            const hasExtras = el.querySelector('svg, .sr-only, [aria-hidden="true"]') !== null;
            const hasPseudo = getComputedStyle(el, '::before').content !== 'none';
            return (
              hasExtras ||
              hasPseudo ||
              wraps ||
              (lineHeight > 0 && el.getBoundingClientRect().height > lineHeight * 1.5)
            );
          })
          .map((el) => el.outerHTML.slice(0, 120)),
      );
      expect(offenders).toEqual([]);
    });
  }

  test('a printed reading page shows every marked heading in full', async ({ page }) => {
    await gotoSettled(page, '/cv');
    await page.waitForFunction(() =>
      document.documentElement.classList.contains('type-reveal-ready'),
    );
    await page.emulateMedia({ media: 'print' });
    const clipped = await page
      .locator(MARKED)
      .evaluateAll((els) =>
        els
          .filter((el) => getComputedStyle(el).clipPath !== 'none')
          .map((el) => el.textContent?.trim() ?? ''),
      );
    expect(clipped, 'print must never inherit the screen typing clip').toEqual([]);
  });
});
