import { describe, expect, it } from 'vitest';
import { FACT_SEPARATOR } from '@/content/fact-separator';
import { readBaseCss, readComponentsCss } from './helpers/components-css';

// behavioral-test-allow: reads the shipped stylesheets; jsdom cannot evaluate pseudo-element content
const base = readBaseCss();
// behavioral-test-allow: reads the shipped stylesheet partials; jsdom cannot evaluate pseudo-element content
const components = readComponentsCss();

const SEPARATOR_GLYPH = FACT_SEPARATOR.trim();
const TOKEN = '--separator-glyph';
const GLYPH_LITERAL = new RegExp(`content:\\s*["']${SEPARATOR_GLYPH}["']`);

describe('the fact separator glyph', () => {
  it('is drawn from one token that matches the glyph the content joins facts with', () => {
    const declaration = new RegExp(`${TOKEN}:\\s*"([^"]*)"`).exec(base);

    expect(declaration, `${TOKEN} must be declared in app/css/base.css`).not.toBeNull();
    expect(
      declaration?.[1],
      'the stylesheet draws the separator between metadata items while content/fact-separator.ts joins the text version; two spellings drift apart',
    ).toBe(SEPARATOR_GLYPH);
  });

  it('is never spelled as a literal in a component rule', () => {
    expect(
      GLYPH_LITERAL.test(components),
      `a component rule that spells the glyph in its content declaration bypasses ${TOKEN}`,
    ).toBe(false);
    expect(components).toContain(`content: var(${TOKEN})`);
  });
});
