// tests/e2e/cross-cutting.spec.ts
//
// Phase 4: cross-cutting behaviour the spec §6 calls out as site-wide
// invariants rather than per-feature paths:
//   1. Skip-to-content link is the first focusable element + targets #main-content
//   2. CSP doesn't block any same-origin asset (network log assertion)
//   3. prefers-reduced-motion disables CRT/decorative animations
//   4. Matrix loop INP guard: a keystroke into the shell input round-trips
//      under 50ms and produces no long task >100ms
//   5. Motion toggle INP guard: a button click commits under 200ms (two rAF
//      cycles — matches the INP "time to next frame presentation" definition)
//
// Each test owns its motion-emulation contract. We deliberately use the
// unprefixed `test` from @playwright/test (not the mockedPage fixture) because
// the fixture force-emulates reduced-motion before goto — needed for visual
// snapshot stability, but a poor fit for test 3 (which sets its own value via
// a fresh context) and test 4 (which wants normal motion so the matrix loop is
// actually running while we measure the keystroke).

import { expect, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';

const BASE_URL = 'http://localhost:3000';

test.describe('cross-cutting', () => {
  test('1 — skip-to-content link is the first focusable element + targets #main-content', async ({
    page,
  }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto('/');
    await page.waitForSelector('main#main-content', { state: 'attached' });

    // The skip link must be the FIRST anchor/button in the DOM tab order. We
    // check this by walking the document for anchors / buttons / form-controls
    // with a non-negative tabindex (or no tabindex on a natively focusable
    // element) and asserting the first one is our skip link. This is the
    // accessibility contract a screen reader honors regardless of the
    // browser's keyboard-only Tab preference (WebKit on macOS, for example,
    // defaults to skipping links during Tab — `keyboard.press('Tab')` would
    // surface that platform quirk instead of the markup contract).
    const firstFocusableIsSkipLink = await page.evaluate(() => {
      const focusableSelector =
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const first = document.querySelector(focusableSelector);
      if (!(first instanceof HTMLAnchorElement)) return { ok: false, tag: first?.tagName };
      return {
        ok: first.classList.contains('skip-to-content'),
        tag: first.tagName,
        href: first.getAttribute('href'),
      };
    });
    expect(
      firstFocusableIsSkipLink.ok,
      `first focusable was ${JSON.stringify(firstFocusableIsSkipLink)}`,
    ).toBe(true);
    expect(firstFocusableIsSkipLink.href).toBe('#main-content');

    // Programmatically focus + activate the link (Enter on a focused anchor
    // is equivalent to a click — works in every engine, free of the WebKit
    // Tab quirk above).
    const skipLink = page.locator('a.skip-to-content');
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await skipLink.press('Enter');

    // URL hash updates synchronously on link activation.
    await expect.poll(() => page.url()).toMatch(/#main-content$/);

    // The hash target must be a focusable container (tabIndex={-1}) so the
    // next sequential focus moves into main content. The <main> in app/page.tsx
    // owns this contract.
    const main = page.locator('main#main-content');
    await expect(main).toHaveAttribute('tabindex', '-1');
  });

  test('2 — CSP does not block any same-origin asset', async ({ page }, testInfo) => {
    // Collect every failed request the browser reports. CSP violations surface
    // as `requestfailed` events whose `failure().errorText` includes a CSP
    // signal (Chromium: "blocked:csp", "ERR_BLOCKED_BY_CSP"; WebKit: "Blocked
    // by Content Security Policy"). Any same-origin failure is a regression.
    const sameOriginFailures: { url: string; reason: string }[] = [];
    page.on('requestfailed', (req) => {
      const url = req.url();
      let sameOrigin = false;
      try {
        sameOrigin = new URL(url).origin === new URL(BASE_URL).origin;
      } catch {
        sameOrigin = false;
      }
      if (!sameOrigin) return;
      const reason = req.failure()?.errorText ?? '';
      // Playwright reports legitimate aborts (navigation away, manual abort)
      // under errorText 'net::ERR_ABORTED' — filter those out, they are not
      // CSP violations.
      if (reason.includes('ABORTED')) return;
      sameOriginFailures.push({ url, reason });
    });

    // Also collect 4xx/5xx responses to same-origin assets — useful signal
    // that something downstream of CSP rewrote a script-src and a route
    // 404'd, even though the request didn't formally "fail".
    const sameOriginBadResponses: { url: string; status: number }[] = [];
    page.on('response', (resp) => {
      const url = resp.url();
      let sameOrigin = false;
      try {
        sameOrigin = new URL(url).origin === new URL(BASE_URL).origin;
      } catch {
        sameOrigin = false;
      }
      if (!sameOrigin) return;
      const status = resp.status();
      // 401/403 are valid auth boundaries, not asset failures. 404s + 5xx
      // on a same-origin asset are.
      if (status >= 400 && status !== 401 && status !== 403) {
        sameOriginBadResponses.push({ url, status });
      }
    });

    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Sanity: critical same-origin assets the layout depends on must have
    // loaded successfully. We collect their URLs from the DOM rather than
    // hard-coding chunk hashes (which change every build).
    const initScriptSrc = await page.evaluate(() => {
      const initScript = document.querySelector('script[src="/init.js"]');
      return initScript instanceof HTMLScriptElement ? initScript.src : null;
    });
    expect(initScriptSrc, '/init.js should be referenced from the document').toContain('/init.js');

    // Self-hosted fonts (next/font) must have loaded. document.fonts.ready
    // resolves once every registered FontFace finishes loading or fails.
    await page.evaluate(() => document.fonts.ready);
    const fontStatuses = await page.evaluate(() =>
      Array.from(document.fonts).map((f) => ({ family: f.family, status: f.status })),
    );
    // next/font generates "<family> Fallback" faces with src: local(...) — their
    // load status reflects CI system-font availability, not whether the
    // self-hosted woff2 shipped. Exclude them; this assertion targets the real
    // self-hosted faces only.
    const failedFonts = fontStatuses.filter(
      (f) => f.status === 'error' && !f.family.endsWith(' Fallback'),
    );
    expect(failedFonts, `Self-hosted fonts failed to load: ${JSON.stringify(failedFonts)}`).toEqual(
      [],
    );

    // Filter failures into CSP vs other. CSP-blocked is the headline regression
    // this test exists to catch.
    const cspFailures = sameOriginFailures.filter(({ reason }) =>
      /csp|content security policy|blocked/i.test(reason),
    );
    expect(
      cspFailures,
      `Same-origin requests blocked by CSP:\n${cspFailures.map((f) => `  ${f.url} -> ${f.reason}`).join('\n')}`,
    ).toEqual([]);

    // Any other same-origin failure is also a regression worth surfacing,
    // but skip noise from dev-overlay polling / hot-update probes.
    const otherFailures = sameOriginFailures.filter(
      (f) => !cspFailures.includes(f) && !/devtools|hot-update/i.test(f.url),
    );
    expect(
      otherFailures,
      `Same-origin requests failed for non-CSP reasons:\n${otherFailures.map((f) => `  ${f.url} -> ${f.reason}`).join('\n')}`,
    ).toEqual([]);

    // Bad responses (4xx/5xx) on same-origin assets — chunk 404s would be
    // the most likely failure mode. Allow hot-update and favicon.ico polling.
    const failedAssets = sameOriginBadResponses.filter(
      ({ url }) => !/hot-update|favicon\.ico/i.test(url),
    );
    expect(
      failedAssets,
      `Same-origin assets returned 4xx/5xx:\n${failedAssets.map((f) => `  ${f.url} -> ${f.status}`).join('\n')}`,
    ).toEqual([]);

    // Cross-browser bonus: parse the response CSP header on the document
    // itself and assert it actually contains 'self' for script-src. Catches
    // a misconfigured proxy.ts that strips the directive.
    const docResp = await page.request.get('/');
    const csp = docResp.headers()['content-security-policy'] ?? '';
    expect(csp, `${testInfo.project.name}: CSP header should be present`).toContain('script-src');
    expect(csp).toContain("'self'");
  });

  test('3 — prefers-reduced-motion disables decorative animations', async ({ browser }) => {
    // Use a fresh context with reducedMotion: 'reduce' set BEFORE any
    // navigation, so /init.js (which writes body[data-motion]) reads the
    // correct preference on first paint. emulateMedia after goto would be
    // too late — the CRT classes mount with animations already running and
    // some keyframes are not restartable cleanly.
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await installMockBackend(page, { log: 'accept', forget: 'happy' });
      await page.goto('/');
      await page.waitForSelector('[data-testid="hero-name"]', { state: 'attached' });

      // Wait for /init.js to apply body[data-motion]. The script runs inline
      // (no defer) but Playwright's "load" event ordering is engine-specific;
      // poll briefly so the test is deterministic across browsers.
      await expect.poll(() => page.evaluate(() => document.body.dataset.motion)).toBe('reduce');

      // For each decorative animation we expect the prefers-reduced-motion
      // CSS rules in CRTOverlay.module.css to disable: assert either animationName is
      // 'none', animationPlayState is 'paused', or computed opacity is 0
      // (the CSS uses `opacity: 0` as a belt-and-braces fallback).
      const selectors = [
        '[data-testid="crt-flicker"]',
        '[data-testid="crt-scan-beam"]',
        '[data-testid="crt-noise"]',
      ];
      let asserted = 0;
      for (const selector of selectors) {
        const el = page.locator(selector).first();
        const exists = (await el.count()) > 0;
        if (!exists) continue;
        const result = await el.evaluate((node) => {
          const cs = getComputedStyle(node);
          return {
            animationName: cs.animationName,
            animationPlayState: cs.animationPlayState,
            opacity: cs.opacity,
          };
        });
        const disabled =
          result.animationName === 'none' ||
          result.animationPlayState === 'paused' ||
          Number(result.opacity) === 0;
        expect(
          disabled,
          `${selector} should be motion-suppressed under prefers-reduced-motion (got ${JSON.stringify(result)})`,
        ).toBe(true);
        asserted++;
      }
      // Sanity: at least one decorative element must have existed and been
      // checked. Zero matches would make this test silently pass even if the
      // whole CRT overlay were removed.
      expect(asserted, 'expected to find at least one decorative CRT element').toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });

  test('4 — shell input INP guard: keystroke commits <50ms with no long task >100ms', async ({
    page,
  }, testInfo) => {
    // INP is a Chrome-only Core Web Vitals metric. webkit doesn't expose the
    // PerformanceObserver('event' / 'longtask') entries used here, and webkit
    // input-event dispatch is materially slower under Playwright emulation —
    // measured 646ms on webkit-mobile CI vs <20ms on chromium. The 50ms wall-
    // clock threshold reflects the project INP budget, which is a Chrome
    // metric. Skip on webkit; chromium projects exercise the same code.
    test.skip(
      testInfo.project.name.startsWith('webkit-'),
      'INP is Chrome-only; webkit input-event dispatch is too slow under emulation to assert <50ms',
    );
    // Why this shape: precise Event Timing API readings from inside Playwright
    // are flaky because the relevant entry types (`event`, `first-input`) are
    // gated on cross-browser support and require the page to install a
    // PerformanceObserver before the event fires. Instead we measure two
    // proxies that together cover the INP budget:
    //
    //   a. Wall-clock from synthetic input dispatch -> React commit -> input
    //      value reflecting the keystroke. If the matrix loop's per-state
    //      re-renders ever come back (banned by the rendering model), this
    //      round-trip blows past 50ms.
    //
    //   b. PerformanceObserver('longtask') during the keystroke window. The
    //      INP budget is 200ms total; a single long task >100ms is the
    //      canonical leading indicator. Long tasks are reported in Chromium
    //      and recent WebKit; missing support degrades to checking only (a).
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto('/');
    await page.waitForSelector('[aria-label="shell command"]', { state: 'visible' });

    // Install the longtask observer BEFORE the keystroke so it captures
    // anything fired during the input. Stash the entries on window for the
    // post-keystroke read.
    await page.evaluate(() => {
      (window as unknown as { __longTasks: PerformanceEntry[] }).__longTasks = [];
      try {
        const obs = new PerformanceObserver((list) => {
          (window as unknown as { __longTasks: PerformanceEntry[] }).__longTasks.push(
            ...list.getEntries(),
          );
        });
        obs.observe({ type: 'longtask', buffered: true });
      } catch {
        // Some browsers don't expose 'longtask'. We still assert (a) so the
        // test isn't a no-op.
      }
    });

    const input = page.locator('[aria-label="shell command"]');
    await input.focus();
    await expect(input).toHaveValue('');

    // Measure wall-clock between keystroke dispatch and the input value
    // reflecting the character. We measure in the browser to avoid
    // Playwright-roundtrip latency dominating the reading.
    const elapsedMs = await page.evaluate(async () => {
      const el = document.querySelector('[aria-label="shell command"]') as HTMLInputElement | null;
      if (!el) throw new Error('shell input not found');
      const start = performance.now();
      // Dispatch a synthetic 'a' keystroke via the InputEvent path React
      // listens to. Direct value mutation skips React's onChange entirely;
      // we use the native input setter + dispatch an 'input' event so
      // React's synthetic-event layer picks it up identically to a real
      // keypress.
      const proto = Object.getPrototypeOf(el) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(el, 'a');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      // Wait one microtask + animation frame for React to commit.
      await Promise.resolve();
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      return performance.now() - start;
    });

    // 50ms leaves headroom under the 200ms INP budget (input delay +
    // processing + presentation). Processing alone should be a small
    // fraction of that.
    expect(
      elapsedMs,
      `keystroke -> DOM commit should be <50ms (got ${elapsedMs.toFixed(1)}ms)`,
    ).toBeLessThan(50);

    await expect(input).toHaveValue('a');

    // No long task >100ms fired during the interaction window.
    const longTasks = await page.evaluate(
      () => (window as unknown as { __longTasks: PerformanceEntry[] }).__longTasks ?? [],
    );
    const offenders = longTasks.filter((t) => t.duration > 100);
    expect(offenders, `Long tasks >100ms during keystroke: ${JSON.stringify(offenders)}`).toEqual(
      [],
    );
  });

  test('5 — motion toggle INP guard: click commits under 200ms (two rAF cycles)', async ({
    page,
  }, testInfo) => {
    // INP is a Chrome-only Core Web Vitals metric — same rationale as test 4.
    test.skip(
      testInfo.project.name.startsWith('webkit-') || testInfo.project.name.includes('mobile'),
      'INP is Chrome-only; motion toggle button is desktop-only (display:none on mobile)',
    );

    // Why two rAF cycles: INP is defined as the time from interaction to next
    // frame *presentation*. The first rAF callback fires before the browser
    // has committed the paint; the second fires after. Two cycles is the
    // standard measurement proxy used by web-vitals and Chrome DevTools.
    //
    // This test replaces the LHCI `interaction-to-next-paint` lab assertion,
    // which returns auditRan:0 for SSG pages because Lighthouse navigation mode
    // never synthesises a click interaction — the audit is structurally N/A in
    // that context. See DECISIONS.md 2026-05-25.
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto('/');
    // Wait for the DesktopTopbar button — body[data-motion] is set by init.js
    // before React, so [data-motion] would match <body> first. Scope to button.
    await page.waitForSelector('button[data-motion]', { state: 'visible' });

    const { elapsedMs, motionFlipped } = await page.evaluate(async () => {
      const btn = document.querySelector<HTMLButtonElement>('button[data-motion]');
      if (!btn || btn.tagName !== 'BUTTON')
        throw new Error('button[data-motion] not found after hydration');
      const before = document.body.dataset.motion;
      const t0 = performance.now();
      btn.click();
      // Two rAF cycles to span input → processing → frame presentation.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      return {
        elapsedMs: performance.now() - t0,
        motionFlipped: document.body.dataset.motion !== before,
      };
    });

    expect(motionFlipped, 'motion toggle click must flip body[data-motion]').toBe(true);
    expect(
      elapsedMs,
      `motion toggle → next paint should be <200ms (got ${elapsedMs.toFixed(1)}ms)`,
    ).toBeLessThan(200);
  });
});
