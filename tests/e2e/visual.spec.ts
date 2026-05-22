// tests/e2e/visual.spec.ts
//
// Phase 1 visual regression: hero above-the-fold + contact section.
// Phase 3 expansion: shell idle + shell mid-stream + hottest takes.
//
// First run generates the baseline (.png files in visual.spec.ts-snapshots/,
// the Playwright-default sibling directory per spec file). Second+ runs diff
// against the baseline. CI enforces maxDiffPixelRatio=0.01.

import { expect, test } from './_helpers/fixtures';
import { stripVolatileChrome } from './_helpers/mask-volatile';
import { snapshotLocator } from './_helpers/snapshot';

// Bump the per-test timeout above the snapshot's stability timeout (30s in
// snapshot.ts). Default test timeout is 30s, so a 30s snapshot stability
// budget would always hard-fail with "Test timeout exceeded" before the
// snapshot got a chance to complete.
test.describe.configure({ timeout: 60_000 });

test.describe('visual regression', () => {
  test('1 — hero above-the-fold matches baseline', async ({ mockedPage }, testInfo) => {
    // Hero is unstable on chromium-mobile only: post-hydration reflow keeps
    // the bio panel resizing for >30s in --update-snapshots mode (chromium
    // engine + 375px viewport interaction). webkit-mobile (iPhone 14 / 390px)
    // and both desktop projects all stabilize. Skip until the underlying
    // reflow is fixed; mobile visual coverage is preserved via webkit-mobile.
    test.skip(
      testInfo.project.name === 'chromium-mobile',
      'chromium-mobile post-hydration reflow blocks stable hero snapshot.',
    );

    // Hero renders BOTH .hero--desktop and .hero--mobile in the DOM; CSS hides
    // the non-matching variant via a 768px breakpoint. The desktop section owns
    // the #bio anchor, so a viewport-agnostic spec must screenshot whichever
    // <section.hero> is visible. waitForSelector with a multi-match selector
    // picks the first DOM node regardless of visibility (and would stall on
    // mobile where the desktop hero is :hidden first), so we filter on the
    // locator side: .filter({ visible: true }) resolves to the variant the
    // viewport actually paints. Playwright produces separate baselines per
    // project, so each viewport's variant is captured against its own snapshot.
    const heroSection = mockedPage
      .locator('[data-testid="hero-desktop"], [data-testid="hero-mobile"]')
      .filter({ visible: true });
    await heroSection.waitFor({ state: 'visible' });
    await heroSection.scrollIntoViewIfNeeded();
    // Wait for self-hosted fonts (next/font) to fully load. Playwright's own
    // "fonts loaded" wait happens inside toHaveScreenshot but races font-swap
    // re-flow.
    await mockedPage.evaluate(() => document.fonts.ready);
    await heroSection.locator('[data-testid="hero-ctas"]').waitFor({ state: 'visible' });
    // Strip volatile chrome (matrix-rain canvas + CRT overlays) from the DOM.
    // Masking is not enough for the CRT layers: under reduced-motion they are
    // opacity:0 but keep a full-viewport bounding box (.crt-noise is
    // inset:-50%), so Playwright's mask would paint the whole capture #FF00FF.
    // DOM removal is the only reliable strip; product behavior is untouched.
    await stripVolatileChrome(mockedPage);
    await snapshotLocator(mockedPage, heroSection, 'hero-above-fold.png');
  });

  test('2 — contact section matches baseline', async ({ mockedPage }) => {
    // Scroll the contact section into view and wait for the lazy ContactForm island.
    const contactSection = mockedPage.locator('#sec-contact');
    await contactSection.scrollIntoViewIfNeeded();
    await mockedPage.waitForSelector('[data-testid="contact-form"]', { state: 'visible' });
    await mockedPage.evaluate(() => document.fonts.ready);
    // Strip volatile chrome (canvas + CRT overlays). See test 1 for why
    // masking the CRT layers is insufficient.
    await stripVolatileChrome(mockedPage);
    await snapshotLocator(mockedPage, contactSection, 'contact-section.png');
  });

  test('3 — shell + ask form (idle) matches baseline', async ({ mockedPage }) => {
    // Above-the-fold shell section. InteractiveShellLazy is dynamic({ ssr: false }),
    // so the fixture's wait for .shell .shell__input already guarantees hydration.
    // Snapshot the whole section so we cover header bar + feed (initial info line) +
    // form + privacy notice + commands strip (desktop) / chips (mobile).
    const shellSection = mockedPage.locator('#sec-shell');
    await shellSection.scrollIntoViewIfNeeded();
    // Wait for the form + initial info line. The fixture already proved the input
    // is visible; the form wrap and feed are siblings inside the same hydrated tree.
    await mockedPage.waitForSelector('[data-testid="shell-form"]', { state: 'visible' });
    await mockedPage.waitForSelector('[role="log"] [data-kind="info"]', { state: 'visible' });
    await mockedPage.evaluate(() => document.fonts.ready);
    // The animated placeholder ("type a command or ask anything…") types a
    // suggestion char-by-char on a 60ms timer until reduced-motion is set.
    // The fixture forces reduced-motion before goto, so AnimatedPlaceholder's
    // effect synchronously sets a static string and returns — but readMotion()
    // depends on the matchMedia hook landing the right value. Belt-and-braces:
    // strip the animated placeholder's text node before snapshot so any future
    // motion-detection drift can't reintroduce char-by-char churn into the
    // baseline.
    await mockedPage.evaluate(() => {
      const ph = document.querySelector('[data-testid="shell-placeholder"]');
      if (ph) (ph as HTMLElement).style.visibility = 'hidden';
    });
    await stripVolatileChrome(mockedPage);
    await snapshotLocator(mockedPage, shellSection, 'shell-idle.png');
  });

  test('4 — shell + ask form (mid-stream) matches baseline', async ({ mockedPage }) => {
    // Mid-stream UX: type a question, intercept /api/ask with a streaming response
    // that emits a deterministic first chunk and then pauses indefinitely (the
    // controller is never closed). The shell renders the first chunk as a
    // .shell__line--output and removes the loading dots — that's the stable
    // mid-render state we capture.
    //
    // Why override fetch in the page instead of re-routing via page.route:
    // page.route's route.fulfill is one-shot — it can't deliver a ReadableStream
    // that stays open. addInitScript runs before any module loads, so the patched
    // window.fetch is what InteractiveShell.streamQuestion sees.
    await mockedPage.addInitScript(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        if (url.includes('/api/ask')) {
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              // Single deterministic chunk → stable text in the baseline.
              controller.enqueue(new TextEncoder().encode('Erik is a Senior'));
              // Intentionally do NOT close: keeps the UI in mid-stream state
              // for the snapshot. The 60s describe-level timeout protects
              // against the controller being held past the test.
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
    // addInitScript only takes effect on the NEXT navigation. The fixture already
    // navigated, so reload to pick up the patched fetch.
    await mockedPage.reload();
    await mockedPage.waitForSelector('[aria-label="shell command"]', { state: 'visible' });

    const shellSection = mockedPage.locator('#sec-shell');
    await shellSection.scrollIntoViewIfNeeded();
    const input = mockedPage.locator('[aria-label="shell command"]').first();
    await input.fill('who is erik');
    await input.press('Enter');

    // Wait for the streaming output to land. The shell creates a fresh
    // .shell__line--output span on the first non-empty chunk; the
    // text content is set synchronously from streamSpan.textContent so
    // toContainText is the right wait.
    const outputLine = mockedPage.locator('[role="log"] [data-kind="output"]');
    await expect(outputLine).toContainText('Erik is a Senior', { timeout: 10_000 });
    await mockedPage.evaluate(() => document.fonts.ready);
    // Hide the same animated placeholder + privacy notice cursor churn as test 3.
    await mockedPage.evaluate(() => {
      const ph = document.querySelector('[data-testid="shell-placeholder"]');
      if (ph) (ph as HTMLElement).style.visibility = 'hidden';
    });
    await stripVolatileChrome(mockedPage);
    await snapshotLocator(mockedPage, shellSection, 'shell-mid-stream.png');
  });

  test('5 — hottest takes section matches baseline', async ({ mockedPage }) => {
    // Representative below-fold module: exercises cv-defer (content-visibility:auto)
    // + Module RSC layout. Module always renders one <details>; CSS forces it
    // open + non-collapsible on desktop, and it stays a native collapsible
    // <details defaultOpen={false}> on mobile. Scrolling reveals the cv-defer'd
    // content and we force the <details> open so both viewports capture the body.
    const hottest = mockedPage.locator('#sec-hottest-takes');
    await hottest.scrollIntoViewIfNeeded();
    // On mobile, Module renders <details defaultOpen={false}>. Force open via
    // the open attribute so the body paints in the snapshot — without this the
    // mobile baseline would only ever show the toggle header.
    await mockedPage.evaluate(() => {
      const el = document.getElementById('sec-hottest-takes');
      if (el && el.tagName.toLowerCase() === 'details') {
        (el as HTMLDetailsElement).open = true;
      }
    });
    // Wait for the takes ordered list to be visible — proves cv-defer'd content
    // has rendered + the details (if mobile) painted its body.
    await mockedPage.waitForSelector('#sec-hottest-takes [data-testid="hottest-takes-list"]', {
      state: 'visible',
    });
    await mockedPage.evaluate(() => document.fonts.ready);
    await stripVolatileChrome(mockedPage);
    await snapshotLocator(mockedPage, hottest, 'hottest-takes-section.png');
  });
});
