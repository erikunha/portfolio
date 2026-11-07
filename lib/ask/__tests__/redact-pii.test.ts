import { describe, expect, it } from 'vitest';
import { EMAIL_PLACEHOLDER, PHONE_PLACEHOLDER, redactPii } from '@/lib/ask/redact-pii';

describe('lib/ask/redact-pii', () => {
  it.each([
    ['email me at jane.doe+jobs@example.co.uk about the role', 'jane.doe+jobs@example.co.uk'],
    ['meu email é joão.silva@empresa.com.br, pode responder?', 'joão.silva@empresa.com.br'],
  ])('replaces an email address in %s', (text, address) => {
    const out = redactPii(text);
    expect(out).not.toContain(address);
    expect(out).toContain(EMAIL_PLACEHOLDER);
  });

  it.each([
    ['call me on +55 (11) 99999-9999 please', '99999-9999'],
    ['liga pra mim: 11 99999-9999', '99999-9999'],
    ['meu número é (21) 3333-4444 e 21 98888 7777', '3333-4444'],
    ['whatsapp +5511999999999', '5511999999999'],
    ['US line 415-555-2671 or (415) 555 2671', '555-2671'],
    ['UK +44 20 7946 0958', '7946 0958'],
    ['dotted 415.555.2671', '555.2671'],
  ])('replaces a phone number in %s', (text, fragment) => {
    const out = redactPii(text);
    expect(out).not.toContain(fragment);
    expect(out).toContain(PHONE_PLACEHOLDER);
  });

  it.each([
    'Erik worked there from 2019 - 2024 as a senior engineer',
    'between 2019-2024 and 2024-2026',
    'commit date 2026-11-07 on Node 22.22.2',
    'what is the 8+ years of experience at 3,000,000 tokens a month?',
    'bundle is 164.7KB with 131.9KB floor and 32.8KB headroom',
    'Lighthouse scores of 95 and 100 on 5 projects',
  ])('leaves a question without personal data unchanged: %s', (text) => {
    expect(redactPii(text)).toBe(text);
  });

  it('redacts every occurrence, not only the first', () => {
    const out = redactPii('a@b.io and c@d.io, 11 99999-9999 / 11 98888-7777');
    expect(out.split(EMAIL_PLACEHOLDER)).toHaveLength(3);
    expect(out.split(PHONE_PLACEHOLDER)).toHaveLength(3);
  });
});
