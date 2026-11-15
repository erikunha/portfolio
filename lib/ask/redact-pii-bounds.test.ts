import { describe, expect, it } from 'vitest';
import { EMAIL_PLACEHOLDER, redactPii } from '@/lib/ask/redact-pii';

const ADVERSARIAL_LENGTH = 8_192;
const TIME_BOUND_MS = 100;

const ADVERSARIAL_INPUTS: readonly (readonly [string, string])[] = [
  ['one long local-part run with no at sign', 'a'.repeat(ADVERSARIAL_LENGTH)],
  ['dotted local-part run with no at sign', 'a.'.repeat(ADVERSARIAL_LENGTH / 2)],
  ['hyphen-separated digits', '1-'.repeat(ADVERSARIAL_LENGTH / 2)],
  ['letters then an unfinished domain', `${'a'.repeat(ADVERSARIAL_LENGTH)}@b`],
];

describe('redactPii cost on adversarial input', () => {
  it.each(ADVERSARIAL_INPUTS)('stays under the time bound for %s', (_label, input) => {
    const startedAt = performance.now();
    redactPii(input);
    expect(performance.now() - startedAt).toBeLessThan(TIME_BOUND_MS);
  });

  it('still redacts an address that follows a very long run of unrelated text', () => {
    const out = redactPii(`${'a '.repeat(ADVERSARIAL_LENGTH / 2)}jane@example.com`);
    expect(out).not.toContain('jane@example.com');
    expect(out.endsWith(EMAIL_PLACEHOLDER)).toBe(true);
  });

  it('redacts the whole local part of a very long address', () => {
    const local = 'x'.repeat(300);
    const out = redactPii(`write to ${local}@example.com now`);
    expect(out).toBe(`write to ${EMAIL_PLACEHOLDER} now`);
  });
});
