import { describe, expect, it } from 'vitest';
import { contactCopy } from '@/content/contact-copy';
import { CONTACT_FIELD, CONTACT_LIMITS } from '@/content/contact-rules';
import { errorMailto, FIELD_CHECKS } from './contact-form-checks';

const copy = contactCopy.en;
const REF = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';

describe('FIELD_CHECKS', () => {
  describe('name', () => {
    const check = FIELD_CHECKS[CONTACT_FIELD.NAME];

    it('rejects blank and whitespace-only values', () => {
      expect(check('')).toBe(false);
      expect(check('   ')).toBe(false);
    });

    it('accepts the minimum and the maximum trimmed length', () => {
      expect(check('a'.repeat(CONTACT_LIMITS.nameMin))).toBe(true);
      expect(check('a'.repeat(CONTACT_LIMITS.nameMax))).toBe(true);
    });

    it('rejects one character past the maximum', () => {
      expect(check('a'.repeat(CONTACT_LIMITS.nameMax + 1))).toBe(false);
    });

    it('measures the trimmed value, not the raw one', () => {
      expect(check(`  ${'a'.repeat(CONTACT_LIMITS.nameMax)}  `)).toBe(true);
    });
  });

  describe('email', () => {
    const check = FIELD_CHECKS[CONTACT_FIELD.EMAIL];

    it('accepts an address with surrounding whitespace', () => {
      expect(check('  ada@example.com  ')).toBe(true);
    });

    it.each(['', 'ada', 'ada@', 'ada@example', 'ada@example.c', 'a da@example.com'])(
      'rejects %j',
      (value) => {
        expect(check(value)).toBe(false);
      },
    );
  });

  describe('message', () => {
    const check = FIELD_CHECKS[CONTACT_FIELD.MESSAGE];

    it('rejects one character under the minimum', () => {
      expect(check('a'.repeat(CONTACT_LIMITS.messageMin - 1))).toBe(false);
    });

    it('accepts the minimum and the maximum', () => {
      expect(check('a'.repeat(CONTACT_LIMITS.messageMin))).toBe(true);
      expect(check('a'.repeat(CONTACT_LIMITS.messageMax))).toBe(true);
    });

    it('rejects one character over the maximum', () => {
      expect(check('a'.repeat(CONTACT_LIMITS.messageMax + 1))).toBe(false);
    });

    it('counts trimmed length, so padding cannot satisfy the minimum', () => {
      expect(check(`${' '.repeat(CONTACT_LIMITS.messageMin)}a`)).toBe(false);
    });
  });
});

describe('errorMailto', () => {
  const emailOnly = `mailto:${copy.section.email}`;

  it('is the bare address when there is no ref', () => {
    expect(errorMailto(copy, '', 'hello')).toBe(emailOnly);
  });

  it('puts the 8-character ref in the subject and the full ref in the body', () => {
    const url = new URL(errorMailto(copy, REF, 'hello there'));
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe(copy.section.email);
    expect(url.searchParams.get('subject')).toBe(`[ref ${REF.slice(0, 8)}] contact`);
    expect(url.searchParams.get('body')).toBe(`ref: ${REF}\n\nhello there`);
  });

  it('keeps dollar sequences in the visitor text literal', () => {
    const text = "price is $& or $' or $` or $1 or $$";
    const url = new URL(errorMailto(copy, REF, text));
    expect(url.searchParams.get('body')).toBe(`ref: ${REF}\n\n${text}`);
  });

  it('does not expand a token written inside the visitor text', () => {
    const url = new URL(errorMailto(copy, REF, 'literal {ref} stays'));
    expect(url.searchParams.get('body')).toBe(`ref: ${REF}\n\nliteral {ref} stays`);
  });

  it('percent-encodes characters that would end the query', () => {
    const href = errorMailto(copy, REF, 'a&b=c#d');
    expect(href).not.toContain('a&b=c#d');
    expect(new URL(href).searchParams.get('body')).toBe(`ref: ${REF}\n\na&b=c#d`);
  });
});
