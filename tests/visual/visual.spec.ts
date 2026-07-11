import { argosScreenshot } from '@argos-ci/playwright';
import { expect, test } from '../e2e/_helpers/fixtures';
import { stripVolatileChrome } from '../e2e/_helpers/mask-volatile';
import { revealDeferredContent, snapshotLocator } from '../e2e/_helpers/snapshot';

test.describe.configure({ timeout: 60_000 });

test.describe('visual regression', () => {
  test('1 — hero above-the-fold matches baseline', async ({ mockedPage }, testInfo) => {
    test.skip(
      testInfo.project.name === 'chromium-mobile',
      'chromium-mobile post-hydration reflow blocks stable hero snapshot.',
    );

    const heroSection = mockedPage
      .locator('[data-testid="hero-desktop"], [data-testid="hero-mobile"]')
      .filter({ visible: true })
      .first();
    await heroSection.waitFor({ state: 'visible' });
    await heroSection.scrollIntoViewIfNeeded();
    await mockedPage.evaluate(() => document.fonts.ready);
    await heroSection.locator('[data-testid="hero-ctas"]').waitFor({ state: 'visible' });
    await stripVolatileChrome(mockedPage);
    if (process.env.ARGOS_TOKEN) {
      await revealDeferredContent(mockedPage);
      await argosScreenshot(mockedPage, 'hero-above-fold', { element: heroSection });
    }
    await snapshotLocator(mockedPage, heroSection, 'hero-above-fold.png');
  });

  test('2 — contact section matches baseline', async ({ mockedPage }) => {
    const contactSection = mockedPage.locator('#sec-contact');
    await contactSection.scrollIntoViewIfNeeded();
    await mockedPage.waitForSelector('[data-testid="contact-form"]', { state: 'visible' });
    await mockedPage.evaluate(() => document.fonts.ready);
    await stripVolatileChrome(mockedPage);
    if (process.env.ARGOS_TOKEN) {
      await revealDeferredContent(mockedPage);
      await argosScreenshot(mockedPage, 'contact-section', { element: contactSection });
    }
    await snapshotLocator(mockedPage, contactSection, 'contact-section.png', {
      maxDiffPixels: 3000,
    });
  });

  test('3 — shell + ask form (idle) matches baseline', async ({ mockedPage }) => {
    const shellSection = mockedPage.locator('#sec-shell');
    await shellSection.scrollIntoViewIfNeeded();
    await mockedPage.waitForSelector('[data-testid="shell-form"]', { state: 'visible' });
    await mockedPage.waitForSelector('[role="log"] [data-kind="info"]', { state: 'visible' });
    await mockedPage.evaluate(() => document.fonts.ready);
    await mockedPage.evaluate(() => {
      const ph = document.querySelector('[data-testid="shell-placeholder"]');
      if (ph) (ph as HTMLElement).style.visibility = 'hidden';
    });
    await stripVolatileChrome(mockedPage);
    if (process.env.ARGOS_TOKEN) {
      await revealDeferredContent(mockedPage);
      await argosScreenshot(mockedPage, 'shell-idle', { element: shellSection });
    }
    await snapshotLocator(mockedPage, shellSection, 'shell-idle.png');
  });

  test('4 — shell + ask form (mid-stream) matches baseline', async ({ mockedPage }) => {
    await mockedPage.addInitScript(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        if (url.includes('/api/ask')) {
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('Erik is a Senior'));
            },
          });
          return new Response(stream, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Request-Id': 'visual-mid-stream-id',
            },
          });
        }
        return realFetch(input, init);
      };
    });
    await mockedPage.reload();
    await mockedPage.waitForSelector('[aria-label="shell command"]', { state: 'visible' });

    const shellSection = mockedPage.locator('#sec-shell');
    await shellSection.scrollIntoViewIfNeeded();
    const input = mockedPage.locator('[aria-label="shell command"]').first();
    await input.fill('who is erik');
    await input.press('Enter');

    const outputLine = mockedPage.locator('[role="log"] [data-kind="output"]');
    await expect(outputLine).toContainText('Erik is a Senior', { timeout: 10_000 });
    await mockedPage.evaluate(() => document.fonts.ready);
    await mockedPage.evaluate(() => {
      const ph = document.querySelector('[data-testid="shell-placeholder"]');
      if (ph) (ph as HTMLElement).style.visibility = 'hidden';
    });
    await stripVolatileChrome(mockedPage);
    if (process.env.ARGOS_TOKEN) {
      await revealDeferredContent(mockedPage);
      await mockedPage.evaluate(() => {
        for (const el of document.querySelectorAll('[aria-busy="true"]')) {
          el.removeAttribute('aria-busy');
        }
      });
      await argosScreenshot(mockedPage, 'shell-mid-stream', { element: shellSection });
    }
    await snapshotLocator(mockedPage, shellSection, 'shell-mid-stream.png');
  });

  test('5 — hottest takes section matches baseline', async ({ mockedPage }) => {
    const hottest = mockedPage.locator('#sec-hottest-takes');
    await hottest.scrollIntoViewIfNeeded();
    await mockedPage.evaluate(() => {
      const el = document.getElementById('sec-hottest-takes');
      if (el && el.tagName.toLowerCase() === 'details') {
        (el as HTMLDetailsElement).open = true;
      }
    });
    await mockedPage.waitForSelector('#sec-hottest-takes [data-testid="hottest-takes-list"]', {
      state: 'visible',
    });
    await mockedPage.evaluate(() => document.fonts.ready);
    await stripVolatileChrome(mockedPage);
    if (process.env.ARGOS_TOKEN) {
      await revealDeferredContent(mockedPage);
      await argosScreenshot(mockedPage, 'hottest-takes-section', { element: hottest });
    }
    await snapshotLocator(mockedPage, hottest, 'hottest-takes-section.png');
  });
});
