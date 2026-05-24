// __tests__/resolve-tokens.test.ts
// Behavioral tests for app/design-system/_lib/resolve-tokens.ts.
// Locks down: number passthrough, plain string passthrough,
// reference resolution, nested reference resolution, missing target fallback.

import { describe, expect, it } from 'vitest';
import { resolveValue } from '@/app/design-system/_lib/resolve-tokens';

type TokenMap = Record<string, { $value: string | number }>;

describe('resolveValue', () => {
  it('returns string representation when value is a number', () => {
    const result = resolveValue(16, {});
    expect(result).toBe('16');
  });

  it('returns zero as string correctly', () => {
    expect(resolveValue(0, {})).toBe('0');
  });

  it('returns the value unchanged when it is a plain string (no reference syntax)', () => {
    expect(resolveValue('8px', {})).toBe('8px');
  });

  it('returns the value unchanged when the string does not match {ref} pattern', () => {
    expect(resolveValue('var(--space-md)', {})).toBe('var(--space-md)');
  });

  it('resolves a {ref} token to the $value of the referenced entry', () => {
    const tokens: TokenMap = {
      'space.md': { $value: '16px' },
    };
    expect(resolveValue('{space.md}', tokens)).toBe('16px');
  });

  it('returns the original value when the referenced token does not exist', () => {
    expect(resolveValue('{space.missing}', {})).toBe('{space.missing}');
  });

  it('resolves nested references recursively', () => {
    const tokens: TokenMap = {
      'space.base': { $value: '4px' },
      'space.md': { $value: '{space.base}' },
    };
    expect(resolveValue('{space.md}', tokens)).toBe('4px');
  });

  it('resolves a numeric $value via reference (converts to string)', () => {
    const tokens: TokenMap = {
      'scale.2': { $value: 8 },
    };
    expect(resolveValue('{scale.2}', tokens)).toBe('8');
  });
});
