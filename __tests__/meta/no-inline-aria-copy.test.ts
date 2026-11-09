import { describe, expect, it } from 'vitest';
import { productionSources } from '../helpers/production-sources';

const SCANNED_ROOTS = ['components'];
const ACCESSIBLE_TEXT_ATTRIBUTE =
  /\b(aria-label|aria-valuetext|aria-description|aria-roledescription|alt|title)=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g;
const TEMPLATE_EXPRESSION = /\$\{[^}]*\}/g;
const WORD = /[A-Za-z]{2,}/;

function literalWords(match: RegExpMatchArray): string {
  const literal = match[2] ?? match[3] ?? match[4] ?? '';
  return literal.replace(TEMPLATE_EXPRESSION, '');
}

describe('accessible names carry no inlined copy', () => {
  it('takes every aria-label, aria-valuetext, alt and title word from content, not from the component', () => {
    const offenders: string[] = [];
    for (const [file, text] of productionSources(SCANNED_ROOTS)) {
      for (const match of text.matchAll(ACCESSIBLE_TEXT_ATTRIBUTE)) {
        const words = literalWords(match);
        if (WORD.test(words)) offenders.push(`${file}: ${match[1]}="${words.trim()}"`);
      }
    }
    expect(
      offenders,
      'a locale-parity test cannot see copy typed into a .tsx; the pt page would speak English. Move the string to content/ with en and pt',
    ).toEqual([]);
  });
});
