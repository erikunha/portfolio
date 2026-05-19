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

test.describe('visual regression', () => {
  test('1 — hero above-the-fold matches baseline', async ({ mockedPage }) => {
    // Hero renders BOTH .hero--desktop and .hero--mobile in the DOM; CSS hides
    // the non-matching variant via a 768px breakpoint. The desktop section owns
    // the #bio anchor, so a viewport-agnostic spec must (1) wait for whichever
    // h1.hero__name becomes visible and (2) screenshot the visible <section>,
    // not #bio. Playwright produces separate baselines per project, so each
    // viewport's variant is captured against its own snapshot.
    await mockedPage.waitForSelector('.hero--desktop h1.hero__name, .hero--mobile h1.hero__name', {
      state: 'visible',
    });
    const heroSection = mockedPage.locator('section.hero').filter({ visible: true });
    await heroSection.scrollIntoViewIfNeeded();
    await snapshotLocator(mockedPage, heroSection, 'hero-above-fold.png');
  });

  test('2 — contact section matches baseline', async ({ mockedPage }) => {
    // Scroll the contact section into view and wait for the lazy ContactForm island.
    const contactSection = mockedPage.locator('#sec-contact');
    await contactSection.scrollIntoViewIfNeeded();
    await mockedPage.waitForSelector('form.contact', { state: 'visible' });
    await snapshotLocator(mockedPage, contactSection, 'contact-section.png');
  });
});
