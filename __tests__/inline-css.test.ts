import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INLINE_CSS } from '@/lib/inline-css';

const CSS_DIR = path.resolve(__dirname, '..', 'app', 'css');

describe('lib/inline-css', () => {
  it('contains every partial CSS file in app/css/ (selector fingerprint per file)', () => {
    // Per-file selector fingerprints chosen because they're known to be unique
    // to that partial and survive CSS minification (selectors are not whitespace-stripped
    // by the minifier; comments are). If a partial is renamed or its key selectors
    // change, update this map AND inspect whether the partial's content still
    // belongs in the inlined bundle.
    const fingerprints: Record<string, string> = {
      '_tokens.css': ':root',
      '_base.css': 'box-sizing',
      '_crt.css': '.crt-overlay',
      '_layout.css': '.boot__cmd',
      '_sections.css': '.codesample',
      '_chrome.css': '.statusbar',
      '_shell.css': '.shell__bar',
      '_contact.css': '.contact__field',
      '_footer.css': '.sd-banner',
      '_responsive.css': '@media',
    };

    const files = readdirSync(CSS_DIR).filter((f) => f.endsWith('.css'));
    for (const file of files) {
      const fingerprint = fingerprints[file];
      expect(
        fingerprint,
        `add a fingerprint for ${file} to __tests__/inline-css.test.ts`,
      ).toBeDefined();
      expect(INLINE_CSS, `expected INLINE_CSS to contain "${fingerprint}" from ${file}`).toContain(
        fingerprint as string,
      );
    }
  });

  it('concatenates in the order matching app/globals.css @import sequence', () => {
    const tokensFirstSelector = ':root';
    const responsiveLastBlock = 'data-motion';
    const tokensIdx = INLINE_CSS.indexOf(tokensFirstSelector);
    const responsiveIdx = INLINE_CSS.indexOf(responsiveLastBlock);
    expect(tokensIdx).toBeGreaterThanOrEqual(0);
    expect(responsiveIdx).toBeGreaterThan(tokensIdx);
  });

  it('contains hero__tagline rule (LCP element)', () => {
    expect(INLINE_CSS).toContain('.hero__tagline');
  });

  it('contains hero__dialog mobile rule (architect guardrail #2)', () => {
    expect(INLINE_CSS).toContain('.hero__dialog');
  });

  it('contains hero__status-dot keyframe binding (architect guardrail #2)', () => {
    expect(INLINE_CSS).toContain('.hero__status-dot');
  });

  it('preserves whitespace around `+` in calc() arithmetic (Copilot review on PR #29)', () => {
    // The codebase has 4+ `calc(... + env(safe-area-inset-...))` expressions in
    // _chrome.css and _layout.css. CSS spec requires whitespace around `+`/`-`
    // inside calc() — `calc(80px+env(...))` is invalid and would silently break
    // the rule on devices with safe-area-inset (notched iOS, Android edge).
    // The fix in lib/inline-css.ts removed `+` from the punctuation-strip class.
    // Regression catcher: every calc() in the output must keep the space.
    const calcs = INLINE_CSS.match(/calc\([^)]+\)/g) ?? [];
    expect(calcs.length, 'expected at least one calc() in inlined CSS').toBeGreaterThan(0);
    for (const c of calcs) {
      // The bug shape is `<digit/percent/px>+<letter or open-paren>` — i.e.,
      // a value immediately followed by `+` immediately followed by another
      // token. Match that exact silent-failure pattern and assert absence.
      expect(c, `calc() expression collapsed +/- whitespace: ${c}`).not.toMatch(
        /[\d%a-z)]\+[\w(]/i,
      );
    }
  });

  it('still strips whitespace around CSS combinators that DO benefit from it', () => {
    // `>` (child) and `~` (general sibling) are still in the strip class.
    // The minifier should collapse `.a > .b` to `.a>.b` and `.a ~ .b` to `.a~.b`
    // — saves bytes without breaking semantics. Look for at least one
    // combinator that survived intact (negative space — the space is gone).
    const combinatorPatterns = [/>[.#a-z]/i, /[}\s][.#a-z][\w-]*~[.#a-z]/i];
    const hasStrippedCombinator = combinatorPatterns.some((p) => p.test(INLINE_CSS));
    expect(hasStrippedCombinator).toBe(true);
  });
});
