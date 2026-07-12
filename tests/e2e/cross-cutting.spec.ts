import { expect, test } from '@playwright/test';
import { DEFERRED_SECTION_COUNT } from '../../components/responsive/Module/module.constants';
import { installMockBackend } from './_helpers/mock-backend';

const BASE_URL = 'http://localhost:3000';

test.describe('cross-cutting', () => {
  test('0 — below-fold sections actually resolve to content-visibility: auto', async ({ page }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto('/');
    await page.waitForSelector('section.module-deferred', { state: 'attached' });

    const resolved = await page.evaluate(() => {
      const deferred = Array.from(document.querySelectorAll('section.module-deferred'));
      return {
        count: deferred.length,
        notAuto: deferred
          .filter((el) => getComputedStyle(el).contentVisibility !== 'auto')
          .map((el) => el.id),
      };
    });

    expect(
      resolved.count,
      `exactly ${DEFERRED_SECTION_COUNT} sections must carry .module-deferred. A >= floor let a silent drop of up to 2 sections pass: they render eagerly and forfeit their share of the ~840ms mobile style+layout deferral with every gate green. Zero means the \`defer\` prop stopped emitting the class entirely.`,
    ).toBe(DEFERRED_SECTION_COUNT);
    expect(
      resolved.notAuto,
      'these deferred sections did NOT compute to content-visibility: auto. A source-text test cannot catch this — the declaration can be present in components.css yet lose the cascade (a later same-specificity rule, a duplicate declaration inside the block, a higher-specificity `section.module-deferred`, an !important, a cross-file @layer, or an inline style). This asserts what the browser actually resolved.',
    ).toEqual([]);
  });

  test('1 — skip-to-content link is the first focusable element + targets #main-content', async ({
    page,
  }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto('/');
    await page.waitForSelector('main#main-content', { state: 'attached' });

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

    const skipLink = page.locator('a.skip-to-content');
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await skipLink.press('Enter');

    await expect.poll(() => page.url()).toMatch(/#main-content$/);

    const main = page.locator('main#main-content');
    await expect(main).toHaveAttribute('tabindex', '-1');
  });

  test('2 — CSP does not block any same-origin asset', async ({ page }, testInfo) => {
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
      if (reason.includes('ABORTED')) return;
      sameOriginFailures.push({ url, reason });
    });

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
      if (status >= 400 && status !== 401 && status !== 403) {
        sameOriginBadResponses.push({ url, status });
      }
    });

    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto('/', { waitUntil: 'networkidle' });

    const motionAttr = await page.evaluate(() => document.body.dataset.motion ?? null);
    expect(motionAttr, 'inline bootstrap must set body[data-motion]').toMatch(/^(full|reduce)$/);

    await page.evaluate(() => document.fonts.ready);
    const fontStatuses = await page.evaluate(() =>
      Array.from(document.fonts).map((f) => ({ family: f.family, status: f.status })),
    );
    const failedFonts = fontStatuses.filter(
      (f) => f.status === 'error' && !f.family.endsWith(' Fallback'),
    );
    expect(failedFonts, `Self-hosted fonts failed to load: ${JSON.stringify(failedFonts)}`).toEqual(
      [],
    );

    const cspFailures = sameOriginFailures.filter(({ reason }) =>
      /csp|content security policy|blocked/i.test(reason),
    );
    expect(
      cspFailures,
      `Same-origin requests blocked by CSP:\n${cspFailures.map((f) => `  ${f.url} -> ${f.reason}`).join('\n')}`,
    ).toEqual([]);

    const otherFailures = sameOriginFailures.filter(
      (f) => !cspFailures.includes(f) && !/devtools|hot-update/i.test(f.url),
    );
    expect(
      otherFailures,
      `Same-origin requests failed for non-CSP reasons:\n${otherFailures.map((f) => `  ${f.url} -> ${f.reason}`).join('\n')}`,
    ).toEqual([]);

    const failedAssets = sameOriginBadResponses.filter(
      ({ url }) => !/hot-update|favicon\.ico/i.test(url),
    );
    expect(
      failedAssets,
      `Same-origin assets returned 4xx/5xx:\n${failedAssets.map((f) => `  ${f.url} -> ${f.status}`).join('\n')}`,
    ).toEqual([]);

    const docResp = await page.request.get('/');
    const csp = docResp.headers()['content-security-policy'] ?? '';
    expect(csp, `${testInfo.project.name}: CSP header should be present`).toContain('script-src');
    expect(csp).toContain("'self'");
  });

  test('3 — prefers-reduced-motion disables decorative animations', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await installMockBackend(page, { log: 'accept', forget: 'happy' });
      await page.goto('/');
      await page.waitForSelector('[data-testid="hero-name"]', { state: 'attached' });

      await expect.poll(() => page.evaluate(() => document.body.dataset.motion)).toBe('reduce');

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
      expect(asserted, 'expected to find at least one decorative CRT element').toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });

  test('4 — shell input INP guard: keystroke commits <50ms with no long task >100ms', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.startsWith('webkit-'),
      'INP is Chrome-only; webkit input-event dispatch is too slow under emulation to assert <50ms',
    );
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto('/');
    await page.waitForSelector('[aria-label="shell command"]', { state: 'visible' });

    await page.evaluate(() => {
      (window as unknown as { __longTasks: PerformanceEntry[] }).__longTasks = [];
      try {
        const obs = new PerformanceObserver((list) => {
          (window as unknown as { __longTasks: PerformanceEntry[] }).__longTasks.push(
            ...list.getEntries(),
          );
        });
        obs.observe({ type: 'longtask', buffered: true });
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
      } catch {}
    });

    const input = page.locator('[aria-label="shell command"]');
    await input.focus();
    await expect(input).toHaveValue('');

    const elapsedMs = await page.evaluate(async () => {
      const el = document.querySelector('[aria-label="shell command"]') as HTMLInputElement | null;
      if (!el) throw new Error('shell input not found');
      const start = performance.now();
      const proto = Object.getPrototypeOf(el) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(el, 'a');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      return performance.now() - start;
    });

    expect(
      elapsedMs,
      `keystroke -> DOM commit should be <50ms (got ${elapsedMs.toFixed(1)}ms)`,
    ).toBeLessThan(50);

    await expect(input).toHaveValue('a');

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
    test.skip(
      testInfo.project.name.startsWith('webkit-') || testInfo.project.name.includes('mobile'),
      'INP is Chrome-only; motion toggle button is desktop-only (display:none on mobile)',
    );

    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto('/');
    await page.waitForSelector('button[data-motion]', { state: 'visible' });

    const { elapsedMs, motionFlipped } = await page.evaluate(async () => {
      const btn = document.querySelector<HTMLButtonElement>('button[data-motion]');
      if (btn?.tagName !== 'BUTTON')
        throw new Error('button[data-motion] not found after hydration');
      const before = document.body.dataset.motion;
      const t0 = performance.now();
      btn.click();
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

  test('6 — DAW mixer mobile CSS override is compiled into the bundle', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="hero-name"]', { state: 'attached' });

    const ruleFound = await page.evaluate((): boolean => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            const text = (rule.cssText ?? '')
              .replace(/\s+/g, ' ')
              .replace(/::/g, ':')
              .toLowerCase();
            if (
              text.includes('mx-chain-mobile') &&
              text.includes(':after') &&
              text.includes('display: none')
            ) {
              return true;
            }
          }
          // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
        } catch {}
      }
      return false;
    });

    expect(
      ruleFound,
      'compiled CSS bundle must contain a .mx-chain-mobile::after { display: none } rule',
    ).toBe(true);
  });

  test('7 — mono font ships font-display:swap and preloads (first-paint render guarantee)', async ({
    page,
  }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    const monoDisplays = await page.evaluate(() =>
      Array.from(document.fonts)
        .filter((f) => {
          const family = f.family.replace(/^["']|["']$/g, '');
          return /mono/i.test(family) && !/ Fallback$/.test(family);
        })
        .map((f) => f.display),
    );
    expect(monoDisplays.length, 'self-hosted mono faces must be registered').toBeGreaterThan(0);
    expect(
      monoDisplays,
      `every mono face must use font-display:swap, got ${JSON.stringify(monoDisplays)}`,
    ).toEqual(monoDisplays.map(() => 'swap'));

    const fontPreloads = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')).map(
        (l) => l.href,
      ),
    );
    expect(
      fontPreloads.filter((h) => /jetbrains[-_]mono.*\.woff2(\?|$)/i.test(h)),
      `expected >=1 JetBrains Mono woff2 preload in <head>, got ${JSON.stringify(fontPreloads)}`,
    ).not.toEqual([]);
  });

  test('8 — body resolves to the self-hosted mono family, not bare monospace (cascade guard)', async ({
    page,
  }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const resolved = await page.evaluate(() => ({
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
      realMonoUsable: document.fonts.check('16px mono'),
    }));
    expect(resolved.realMonoUsable, 'self-hosted mono face must be loaded').toBe(true);
    expect(
      resolved.bodyFontFamily,
      `body must resolve to the next/font "mono" face first, got ${resolved.bodyFontFamily}`,
    ).toMatch(/^["']?mono["']?\s*(,|$)/);
  });
});
