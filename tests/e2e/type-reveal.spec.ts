import { expect, test } from '@playwright/test';

const MARKED_HEADING = '#about-header > [data-type-reveal]';

test.describe('type reveal', () => {
  test('a marked heading types in once it scrolls into view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.waitForFunction(() =>
      document.documentElement.classList.contains('type-reveal-ready'),
    );

    const heading = page.locator(MARKED_HEADING);
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

  for (const route of ['/', '/cv', '/summary', '/links']) {
    test(`marked elements on ${route} hold only typed text and stay on one line`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
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
            const hasPseudo = ['::before', '::after'].some(
              (pseudo) => pseudo === '::before' && getComputedStyle(el, pseudo).content !== 'none',
            );
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
