// __tests__/z-index-scale.test.ts
// Behavioral test for the --ds-z-* layer scale (Milestone 1, Task 1.1).
// Locks: the scale exists, resolves to unitless integers, and is strictly
// ordered base < content < chrome < dock < emergency < skiplink so the
// documented stacking contract cannot silently invert.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(path.join(ROOT, 'design-system/dist/tokens.json'), 'utf8'));
const css = readFileSync(path.join(ROOT, 'design-system/dist/tokens.css'), 'utf8');

// dist/tokens.json keys are PascalCase without the -- prefix (e.g. DsZChrome).
const z = (k: string): number => {
  const raw = tokens[`DsZ${k}`];
  expect(raw, `DsZ${k} should exist in dist/tokens.json`).toBeDefined();
  return Number(raw);
};

describe('--ds-z-* layer scale', () => {
  it('defines every layer as a finite unitless integer', () => {
    for (const k of ['Base', 'Content', 'Chrome', 'Dock', 'Emergency', 'Skiplink']) {
      const v = z(k);
      expect(Number.isInteger(v), `DsZ${k} must be an integer, got ${tokens[`DsZ${k}`]}`).toBe(
        true,
      );
    }
  });

  it('is strictly ordered so the stacking contract holds', () => {
    expect(z('Base')).toBeLessThan(z('Content'));
    expect(z('Content')).toBeLessThan(z('Chrome'));
    expect(z('Chrome')).toBeLessThan(z('Dock'));
    expect(z('Dock')).toBeLessThan(z('Emergency'));
    expect(z('Emergency')).toBeLessThan(z('Skiplink'));
  });

  it('emits unitless custom properties in tokens.css (no px on z-index)', () => {
    const match = css.match(/--ds-z-chrome:\s*([^;]+);/);
    expect(match, '--ds-z-chrome must be present in tokens.css').not.toBeNull();
    const value = (match?.[1] ?? '').trim();
    expect(value).not.toMatch(/px/);
  });
});
