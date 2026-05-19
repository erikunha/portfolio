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
    // Wait for the hero to be fully painted. The hero uses no async data.
    await mockedPage.waitForSelector('.hero--desktop h1.hero__name', { state: 'visible' });
    // Clip to the hero section so the snapshot is semantically scoped to the
    // above-the-fold hero region — independent of below-fold layout drift.
    const heroSection = mockedPage.locator('#bio');
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
