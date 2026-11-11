import { expect, test } from '@playwright/test';

/**
 * The policy has to hold two things at once: the font the platform inlines as
 * a data: URI has to load, and the script it inlines has to stay refused. The
 * browser logs a refusal for each, so the console is the witness.
 */

const PROBE_FAMILY = 'CspProbeFont';
const INVALID_FONT = 'data:font/woff2;base64,AAAA';

test.describe('the content security policy', () => {
  test('an inlined font loads and an inlined script stays refused', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('Content Security Policy')) violations.push(text);
    });

    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-name"]', { state: 'attached' });

    await page.evaluate(
      ({ family, font }) => {
        const style = document.createElement('style');
        style.textContent = `@font-face { font-family: ${family}; src: url(${font}) format('woff2'); }`;
        document.head.append(style);
        const script = document.createElement('script');
        script.src = 'data:text/javascript,void 0';
        document.head.append(script);
      },
      { family: PROBE_FAMILY, font: INVALID_FONT },
    );

    await page.evaluate(async (family) => {
      try {
        await document.fonts.load(`16px ${family}`);
      } catch {
        // The probe font is not a real font; the browser refuses to parse it.
        // What matters here is whether the policy refused it first.
      }
    }, PROBE_FAMILY);
    await page.waitForTimeout(500);

    const fontViolations = violations.filter((violation) => /font/i.test(violation));
    const scriptViolations = violations.filter((violation) => /script/i.test(violation));

    expect(
      fontViolations,
      `the policy refused the inlined font:\n${fontViolations.join('\n')}`,
    ).toEqual([]);
    expect(
      scriptViolations.length,
      'the policy has to keep refusing an inlined script',
    ).toBeGreaterThan(0);
  });

  test('the header states the font directive the page needs', async ({ page }) => {
    const response = await page.request.get('/');
    const csp = response.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' data:");
  });
});
