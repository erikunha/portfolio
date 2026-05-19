// tests/e2e/visual.spec.ts
//
// Phase 1 visual regression: hero above-the-fold + contact section.
// Full surface (shell/ask, hottest takes) ships in Phase 2-3.
//
// First run generates the baseline (.png files in __snapshots__/).
// Second+ runs diff against the baseline. CI enforces maxDiffPixelRatio=0.01.

import { test } from './_helpers/fixtures';
import { snapshot } from './_helpers/snapshot';

test.describe('visual regression', () => {
  test('1 — hero above-the-fold matches baseline', async ({ mockedPage }) => {
    // Wait for the hero to be fully painted. The hero uses no async data.
    await mockedPage.waitForSelector('.hero--desktop h1.hero__name', { state: 'visible' });
    // Clip to the hero section only to avoid variance from below-fold sections.
    const heroSection = mockedPage.locator('#bio');
    await heroSection.scrollIntoViewIfNeeded();
    await snapshot(mockedPage, 'hero-above-fold.png');
  });

  test('2 — contact section matches baseline', async ({ mockedPage }) => {
    // Scroll the contact section into view and wait for the lazy ContactForm island.
    await mockedPage.locator('#sec-contact').scrollIntoViewIfNeeded();
    await mockedPage.waitForSelector('form.contact', { state: 'visible' });
    await snapshot(mockedPage, 'contact-section.png');
  });
});
