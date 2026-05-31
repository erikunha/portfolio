/**
 * Token assertion tests for --ds-overlay-* and --ds-glow-* alpha tokens.
 *
 * Tests parse design-system/dist/tokens.css and assert that each token
 * resolves to the exact rgba() literal defined in color.json.
 *
 * Byte-identical match is required: the value in tokens.css must equal
 * the value used at the call site (no rounding or interpolation drift).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const TOKENS_CSS_PATH = path.resolve(import.meta.dirname ?? __dirname, '../../dist/tokens.css');

function parseTokens(css: string): Record<string, string> {
  const map: Record<string, string> = {};
  // Match: --token-name: value;
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/g;
  for (const m of css.matchAll(re)) {
    map[`--${m[1]}`] = m[2].trim();
  }
  return map;
}

const css = readFileSync(TOKENS_CSS_PATH, 'utf8');
const tokens = parseTokens(css);

// ─── Overlay blacks ───────────────────────────────────────────────────────────
describe('--ds-overlay-* tokens', () => {
  test('--ds-overlay-22 resolves to rgba(0, 0, 0, 0.22)', () => {
    expect(tokens['--ds-overlay-22']).toBe('rgba(0, 0, 0, 0.22)');
  });
  test('--ds-overlay-30 resolves to rgba(0, 0, 0, 0.3)', () => {
    expect(tokens['--ds-overlay-30']).toBe('rgba(0, 0, 0, 0.3)');
  });
  test('--ds-overlay-35 resolves to rgba(0, 0, 0, 0.35)', () => {
    expect(tokens['--ds-overlay-35']).toBe('rgba(0, 0, 0, 0.35)');
  });
  test('--ds-overlay-40 resolves to rgba(0, 0, 0, 0.4)', () => {
    expect(tokens['--ds-overlay-40']).toBe('rgba(0, 0, 0, 0.4)');
  });
  test('--ds-overlay-50 resolves to rgba(0, 0, 0, 0.5)', () => {
    expect(tokens['--ds-overlay-50']).toBe('rgba(0, 0, 0, 0.5)');
  });
  test('--ds-overlay-55 resolves to rgba(0, 0, 0, 0.55)', () => {
    expect(tokens['--ds-overlay-55']).toBe('rgba(0, 0, 0, 0.55)');
  });
  test('--ds-overlay-60 resolves to rgba(0, 0, 0, 0.6)', () => {
    expect(tokens['--ds-overlay-60']).toBe('rgba(0, 0, 0, 0.6)');
  });
  test('--ds-overlay-65 resolves to rgba(0, 0, 0, 0.65)', () => {
    expect(tokens['--ds-overlay-65']).toBe('rgba(0, 0, 0, 0.65)');
  });
  test('--ds-overlay-70 resolves to rgba(0, 0, 0, 0.7)', () => {
    expect(tokens['--ds-overlay-70']).toBe('rgba(0, 0, 0, 0.7)');
  });
  test('--ds-overlay-85 resolves to rgba(0, 0, 0, 0.85)', () => {
    expect(tokens['--ds-overlay-85']).toBe('rgba(0, 0, 0, 0.85)');
  });
  test('--ds-overlay-92 resolves to rgba(0, 0, 0, 0.92)', () => {
    expect(tokens['--ds-overlay-92']).toBe('rgba(0, 0, 0, 0.92)');
  });
});

// ─── Glow greens ─────────────────────────────────────────────────────────────
// NOTE: rgba(0, 255, 65, 0.025) is NOT tokenized — Style Dictionary rounds
// 0.025 → 0x06 → 0.0235 (hex precision loss). That single site (Footer:79
// gradient endpoint) stays in the allowlist as a documented exception.
describe('--ds-glow-* tokens', () => {
  test('--ds-glow-03 resolves to rgba(0, 255, 65, 0.03)', () => {
    expect(tokens['--ds-glow-03']).toBe('rgba(0, 255, 65, 0.03)');
  });
  test('--ds-glow-04 resolves to rgba(0, 255, 65, 0.04)', () => {
    expect(tokens['--ds-glow-04']).toBe('rgba(0, 255, 65, 0.04)');
  });
  test('--ds-glow-05 resolves to rgba(0, 255, 65, 0.05)', () => {
    expect(tokens['--ds-glow-05']).toBe('rgba(0, 255, 65, 0.05)');
  });
  test('--ds-glow-06 resolves to rgba(0, 255, 65, 0.06)', () => {
    expect(tokens['--ds-glow-06']).toBe('rgba(0, 255, 65, 0.06)');
  });
  test('--ds-glow-15 resolves to rgba(0, 255, 65, 0.15)', () => {
    expect(tokens['--ds-glow-15']).toBe('rgba(0, 255, 65, 0.15)');
  });
  test('--ds-glow-18 resolves to rgba(0, 255, 65, 0.18)', () => {
    expect(tokens['--ds-glow-18']).toBe('rgba(0, 255, 65, 0.18)');
  });
  test('--ds-glow-25 resolves to rgba(0, 255, 65, 0.25)', () => {
    expect(tokens['--ds-glow-25']).toBe('rgba(0, 255, 65, 0.25)');
  });
  test('--ds-glow-30 resolves to rgba(0, 255, 65, 0.3)', () => {
    expect(tokens['--ds-glow-30']).toBe('rgba(0, 255, 65, 0.3)');
  });
  test('--ds-glow-35 resolves to rgba(0, 255, 65, 0.35)', () => {
    expect(tokens['--ds-glow-35']).toBe('rgba(0, 255, 65, 0.35)');
  });
  test('--ds-glow-40 resolves to rgba(0, 255, 65, 0.4)', () => {
    expect(tokens['--ds-glow-40']).toBe('rgba(0, 255, 65, 0.4)');
  });
  test('--ds-glow-45 resolves to rgba(0, 255, 65, 0.45)', () => {
    expect(tokens['--ds-glow-45']).toBe('rgba(0, 255, 65, 0.45)');
  });
  test('--ds-glow-50 resolves to rgba(0, 255, 65, 0.5)', () => {
    expect(tokens['--ds-glow-50']).toBe('rgba(0, 255, 65, 0.5)');
  });
  test('--ds-glow-55 resolves to rgba(0, 255, 65, 0.55)', () => {
    expect(tokens['--ds-glow-55']).toBe('rgba(0, 255, 65, 0.55)');
  });
  test('--ds-glow-60 resolves to rgba(0, 255, 65, 0.6)', () => {
    expect(tokens['--ds-glow-60']).toBe('rgba(0, 255, 65, 0.6)');
  });
});
