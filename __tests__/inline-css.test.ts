import { readdirSync, readFileSync } from 'node:fs';
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
      expect(
        INLINE_CSS,
        `expected INLINE_CSS to contain "${fingerprint}" from ${file}`,
      ).toContain(fingerprint as string);
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
});
