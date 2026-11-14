import { parse } from 'postcss';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesWithSelector } from '@/__tests__/helpers/css-rules';

const stylesheet = parse(readComponentsCss());

describe('contact error summary links', () => {
  const [rule] = rulesWithSelector(stylesheet, '.contact-alert .contact-summary-link');

  it('outrank the alert link rule that gave every link a 44px box', () => {
    expect(
      rule,
      'the summary link rule must be at least as specific as `.contact-alert a`',
    ).toBeDefined();
  });

  it('stay inline so a link does not make its line taller than the text', () => {
    expect(declValue(rule, 'display')).toBe('inline');
    expect(declValue(rule, 'min-height')).toBe('0');
  });

  it('keep the 28px hit area through a pseudo-element, as the company link does', () => {
    const [hitArea] = rulesWithSelector(stylesheet, '.contact-alert .contact-summary-link::before');
    expect(declValue(hitArea, 'height')).toBe('var(--spacing-target-compact)');
    expect(declValue(rule, 'position')).toBe('relative');
  });
});
