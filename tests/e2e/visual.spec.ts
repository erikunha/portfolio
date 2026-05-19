// tests/e2e/visual.spec.ts
//
// Phase 1 visual regression: hero above-the-fold + contact section.
// Full surface (shell/ask, hottest takes) ships in Phase 2-3.
//
// First run generates the baseline (.png files in visual.spec.ts-snapshots/,
// the Playwright-default sibling directory per spec file). Second+ runs diff
// against the baseline. CI enforces maxDiffPixelRatio=0.01.

import { test } from './_helpers/fixtures';
import { snapshotLocator } from './_helpers/snapshot';

// Bump the per-test timeout above the snapshot's stability timeout (30s in
// snapshot.ts). Default test timeout is 30s, so a 30s snapshot stability
// budget would always hard-fail with "Test timeout exceeded" before the
// snapshot got a chance to complete.
test.describe.configure({ timeout: 60_000 });

test.describe('visual regression', () => {
  test('1 — hero above-the-fold matches baseline', async ({ mockedPage }) => {
    // Hero renders BOTH .hero--desktop and .hero--mobile in the DOM; CSS hides
    // the non-matching variant via a 768px breakpoint. The desktop section owns
    // the #bio anchor, so a viewport-agnostic spec must screenshot whichever
    // <section.hero> is visible. waitForSelector with a multi-match selector
    // picks the first DOM node regardless of visibility (and would stall on
    // mobile where the desktop hero is :hidden first), so we filter on the
    // locator side: .filter({ visible: true }) resolves to the variant the
    // viewport actually paints. Playwright produces separate baselines per
    // project, so each viewport's variant is captured against its own snapshot.
    const heroSection = mockedPage.locator('section.hero').filter({ visible: true });
    await heroSection.waitFor({ state: 'visible' });
    await heroSection.scrollIntoViewIfNeeded();
    // Wait for self-hosted fonts (next/font) to fully load. Playwright's own
    // "fonts loaded" wait happens inside toHaveScreenshot but races font-swap
    // re-flow.
    await mockedPage.evaluate(() => document.fonts.ready);
    await heroSection.locator('.hero__ctas').waitFor({ state: 'visible' });
    // Remove the matrix-rain <canvas aria-hidden> before snapshotting. The
    // canvas is sized to its parent and resizes / re-paints during post-
    // hydration reflow; combined with Playwright's mask layer (which colors
    // the canvas pink in the screenshot), tiny canvas-bbox shifts produce
    // huge "diff" deltas in the two-consecutive-stable-screenshots check.
    // Removing the canvas from DOM eliminates the volatile region entirely
    // for snapshot purposes — the actual product behavior is untouched.
    await mockedPage.evaluate(() => {
      for (const c of document.querySelectorAll('canvas[aria-hidden]')) c.remove();
    });
    await snapshotLocator(mockedPage, heroSection, 'hero-above-fold.png');
  });

  test('2 — contact section matches baseline', async ({ mockedPage }) => {
    // Scroll the contact section into view and wait for the lazy ContactForm island.
    const contactSection = mockedPage.locator('#sec-contact');
    await contactSection.scrollIntoViewIfNeeded();
    await mockedPage.waitForSelector('form.contact', { state: 'visible' });
    await mockedPage.evaluate(() => document.fonts.ready);
    // Same canvas removal as test 1 — see comment there for rationale.
    await mockedPage.evaluate(() => {
      for (const c of document.querySelectorAll('canvas[aria-hidden]')) c.remove();
    });
    await snapshotLocator(mockedPage, contactSection, 'contact-section.png');
  });
});
