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
          heading.evaluate((el) => {
            const running = el.getAnimations().filter((animation) => {
              return (animation as CSSAnimation).animationName === 'type-reveal-clip';
            });
            return (
              running.length > 0 && running.every((animation) => animation.playState === 'finished')
            );
          }),
        {
          message: 'the heading must run the clip-path typing animation to its end',
          timeout: TYPING_TIMEOUT_MS,
        },
      )
      .toBe(true);
    expect(
      await heading.evaluate((el) => getComputedStyle(el).clipPath),
      'the finished reveal leaves only the caret overhang clipped off',
    ).toMatch(/^inset\(0px (?:-[\d.]+px|calc\(0% - [\d.]+px\)) 0px 0px\)$/);
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

const BOTTOM_ZONE_RATIO = 0.94;
const BOTTOM_ZONE_FLOOR = 0.88;
const MIN_HEADING_TOP_PX = 300;
const REVEAL_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
] as const;

test.describe('type reveal at first paint', () => {
  for (const viewport of REVEAL_VIEWPORTS) {
    test(`a heading near the bottom edge of the ${viewport.width}px first screen is not left blank`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await gotoSettled(page, '/');
      const target = await page.locator(MARKED).evaluateAll((els, minTop) => {
        const index = els.findIndex(
          (el) => el.getBoundingClientRect().top + window.scrollY > minTop && el.checkVisibility(),
        );
        const el = els[index];
        return { index, top: el ? el.getBoundingClientRect().top + window.scrollY : 0 };
      }, MIN_HEADING_TOP_PX);
      expect(
        target.index,
        'the page needs a marked heading below the top of the page',
      ).toBeGreaterThanOrEqual(0);

      await page.setViewportSize({
        width: viewport.width,
        height: Math.ceil(target.top / BOTTOM_ZONE_RATIO),
      });
      await gotoSettled(page, '/');
      await page.waitForFunction(() =>
        document.documentElement.classList.contains('type-reveal-ready'),
      );
      const placement = await page
        .locator(MARKED)
        .nth(target.index)
        .evaluate((el) => el.getBoundingClientRect().top / window.innerHeight);
      expect(
        placement,
        'the heading must start inside the bottom twelfth of the screen',
      ).toBeGreaterThan(BOTTOM_ZONE_FLOOR);
      expect(placement).toBeLessThan(1);
      await expect(
        page.locator(MARKED).nth(target.index),
        'a heading already on screen at load must start typing without a scroll',
      ).toHaveClass(/is-typed/);
    });
  }
});
