// @vitest-environment node
import type { Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { compiledStylesheet, type StylesheetEntry } from './helpers/css-rules';

const ENTRIES: StylesheetEntry[] = ['globals', 'home'];
const PSEUDO_ELEMENT_INSIDE_IS = /:(?:is|where)\([^()]*::/;

describe('compiled stylesheet', () => {
  it.each(ENTRIES)('never puts a pseudo-element inside :is() or :where() in %s', async (entry) => {
    const root = await compiledStylesheet(entry);
    const invalid: string[] = [];
    root.walkRules((rule: Rule) => {
      if (PSEUDO_ELEMENT_INSIDE_IS.test(rule.selector)) invalid.push(rule.selector);
    });
    expect(
      invalid,
      'a pseudo-element inside :is() is invalid CSS and the browser drops the whole rule; split the comma list into one rule per selector before nesting a variant',
    ).toEqual([]);
  });
});
