// __tests__/font-size-micro.test.ts
// Locks --ds-font-size-micro (Milestone 1, Task 1.4): the recurring 9px CRT
// metadata label size, promoted from a raw literal to a token. Asserts it
// resolves to 9px and is the smallest font-size token (below xs/2xs at 10px).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(path.join(ROOT, 'design-system/dist/tokens.css'), 'utf8');

const px = (name: string): number => {
  const match = css.match(new RegExp(`--${name}:\\s*([0-9.]+)px`));
  expect(match, `--${name} should resolve to a px value in tokens.css`).not.toBeNull();
  return Number(match?.[1] ?? Number.NaN);
};

describe('--ds-font-size-micro', () => {
  it('resolves to 9px', () => {
    expect(px('ds-text-size-micro')).toBe(9);
  });

  it('is smaller than the next size up (xs = 10px)', () => {
    expect(px('ds-text-size-micro')).toBeLessThan(px('ds-text-size-xs'));
  });
});
