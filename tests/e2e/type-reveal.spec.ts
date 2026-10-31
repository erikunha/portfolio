import { expect, test } from '@playwright/test';

const MARKED = '[data-type-reveal]';

test.describe('type reveal', () => {
  test('a marked heading types in once it scrolls into view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
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
      .poll(() =>
        heading.evaluate((el) => getComputedStyle(el).getPropertyValue('--type-progress').trim()),
      )
      .toBe('1');
    expect(Number(await heading.evaluate((el) => el.style.getPropertyValue('--type-chars')))).toBe(
      ((await heading.textContent()) ?? '').trim().length,
    );
  });

  test('with reduced motion every marked element is fully visible at load', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
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
  const HOME_ROUTE = '/';
  const HOME_MIN_WIDTH = 375;
  const routeWidths = [HOME_ROUTE, '/cv', '/summary', '/links'].flatMap((route) =>
    NARROW_WIDTHS.filter((width) => route !== HOME_ROUTE || width >= HOME_MIN_WIDTH).map(
      (width) => ({ route, width }),
    ),
  );
  for (const { route, width } of routeWidths) {
    test(`marked elements on ${route} at ${width}px hold only typed text and stay on one line`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto(route);
      await page.waitForFunction(() =>
        document.documentElement.classList.contains('type-reveal-ready'),
      );

      await page.addStyleTag({
        content: '.module-deferred { content-visibility: visible !important; }',
      });
      const marked = page.locator('[data-type-reveal]');
      expect(await marked.count()).toBeGreaterThan(0);
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
});
