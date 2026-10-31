import { expect, type Locator, test } from '@playwright/test';

const BELOW_FOLD_HEADER = '#sec-contact-header .module-scroll-type-text:visible';
const BELOW_FOLD_GAP_PX = 100;
const BELOW_FOLD_TOLERANCE_PX = 60;
const PLACE_ATTEMPTS = 8;

const STABLE_READINGS = 2;

async function placeJustBelowFold(header: Locator): Promise<void> {
  let stable = 0;
  for (let attempt = 0; attempt < PLACE_ATTEMPTS && stable < STABLE_READINGS; attempt++) {
    const gap = await header.evaluate((el, target) => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top - window.innerHeight - target, behavior: 'instant' });
      return new Promise<number>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve(el.getBoundingClientRect().top - window.innerHeight)),
        ),
      );
    }, BELOW_FOLD_GAP_PX);
    stable = Math.abs(gap - BELOW_FOLD_GAP_PX) <= BELOW_FOLD_TOLERANCE_PX ? stable + 1 : 0;
  }
  expect(stable, 'the header settles just below the fold once the modules above render').toBe(
    STABLE_READINGS,
  );
}

test.describe('scroll typing', () => {
  test('with reduced motion the header is fully visible and static', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-name"]', { state: 'attached' });

    const header = page.locator(BELOW_FOLD_HEADER);
    await header.scrollIntoViewIfNeeded();

    const clipPath = await header.evaluate((el) => getComputedStyle(el).clipPath);
    expect(clipPath).toBe('none');

    const text = (await header.textContent()) ?? '';
    expect(text.length).toBeGreaterThan(0);
    const chars = await header.evaluate((el) => {
      const hook = el.closest('.module-scroll-type');
      return hook ? getComputedStyle(hook).getPropertyValue('--module-type-chars').trim() : '';
    });
    expect(chars).toBe(String(text.length));
  });

  test('types the header in as the section scrolls into view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-name"]', { state: 'attached' });

    const supported = await page.evaluate(() => CSS.supports('animation-timeline: view()'));
    test.skip(!supported, 'engine lacks animation-timeline: view()');

    const header = page.locator(BELOW_FOLD_HEADER);
    await header.waitFor({ state: 'attached' });

    // Near enough that content-visibility renders the section and the view()
    // timeline resolves, far enough that the header is still below the fold.
    await placeJustBelowFold(header);

    const startClip = await header.evaluate((el) => getComputedStyle(el).clipPath);
    expect(startClip).toContain('100%');

    await header.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await header.evaluate(() => new Promise(requestAnimationFrame));

    const endClip = await header.evaluate((el) => getComputedStyle(el).clipPath);
    expect(endClip).toMatch(/inset\(0(px|%) 0(px|%) 0(px|%) 0(px|%)\)/);
  });

  test('the caret parks at the end of the typed header', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-name"]', { state: 'attached' });

    const supported = await page.evaluate(() => CSS.supports('animation-timeline: view()'));
    test.skip(!supported, 'engine lacks animation-timeline: view()');

    const header = page.locator(BELOW_FOLD_HEADER);
    await placeJustBelowFold(header);
    await header.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await header.evaluate(() => new Promise(requestAnimationFrame));

    const { delta, left } = await header.evaluate((el) => {
      const host = el.closest('.module-scroll-type');
      if (!host) throw new Error('missing .module-scroll-type host');
      const caret = getComputedStyle(host, '::after');
      const offsetX = new DOMMatrixReadOnly(caret.transform).m41;
      const hostRect = host.getBoundingClientRect();
      const caretLeft = hostRect.left + offsetX + hostRect.width;
      return { delta: Math.abs(caretLeft - el.getBoundingClientRect().right), left: caret.left };
    });

    expect(left).toBe('0px');
    expect(delta).toBeLessThan(1);
  });

  test('the MOTION toggle disables the typing animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-name"]', { state: 'attached' });

    const header = page.locator(BELOW_FOLD_HEADER);
    await header.waitFor({ state: 'attached' });
    await page.evaluate(() => {
      document.body.dataset.motion = 'reduce';
    });
    await header.scrollIntoViewIfNeeded();

    const clipPath = await header.evaluate((el) => getComputedStyle(el).clipPath);
    expect(clipPath).toBe('none');
  });
});
