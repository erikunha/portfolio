import { describe, expect, it } from 'vitest';
import { canonicalJSON } from '../detect-changes.mjs';

describe('canonicalJSON', () => {
  it('sorts object keys recursively (key order does not matter)', () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe(canonicalJSON({ a: 2, b: 1 }));
    expect(canonicalJSON({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it('preserves array order (order DOES matter for browserslist)', () => {
    expect(canonicalJSON(['chrome >= 95', 'firefox'])).toBe('["chrome >= 95","firefox"]');
    expect(canonicalJSON(['chrome >= 95', 'firefox'])).not.toBe(
      canonicalJSON(['firefox', 'chrome >= 95']),
    );
  });

  it('serializes null and (the null-fill hazard) treats undefined as null', () => {
    expect(canonicalJSON({ browserslist: null, pnpm: null })).toBe(
      '{"browserslist":null,"pnpm":null}',
    );
    // A naive JSON.stringify of { x: undefined } omits x; canonicalJSON must emit null.
    expect(canonicalJSON({ x: undefined })).toBe('{"x":null}');
  });

  it('is whitespace-free for nested structures', () => {
    expect(canonicalJSON({ pnpm: { overrides: { zod: '4.4.3' } } })).toBe(
      '{"pnpm":{"overrides":{"zod":"4.4.3"}}}',
    );
  });
});
