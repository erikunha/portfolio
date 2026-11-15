// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseThemeColors } from '../app/(en)/design-system/_lib/theme-tokens';

const ROOT = path.resolve(__dirname, '..');
const THEME_CSS = readFileSync(path.join(ROOT, 'app/css/theme.css'), 'utf8');
const PRINT_CSS = readFileSync(path.join(ROOT, 'app/css/print.css'), 'utf8');
const CONTRAST_SCRIPT = path.join(ROOT, 'scripts/contrast-check.mjs');

const ROLES = [
  'surface',
  'surface-raised',
  'border',
  'border-strong',
  'accent',
  'on-accent',
  'text',
  'text-muted',
  'focus',
  'warning',
  'danger',
  'scrim',
];

const PRIMITIVE_REFERENCE = /^var\(--color-(?:primary|secondary|tertiary|quinary|senary)-\w+\)$/;
const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3;
const CHANNEL_WEIGHTS = [0.2126, 0.7152, 0.0722];

const ROLE_PAIRS: [string, string, number][] = [
  ['text', 'surface', TEXT_MIN],
  ['text-muted', 'surface', TEXT_MIN],
  ['on-accent', 'accent', TEXT_MIN],
  ['accent', 'surface', NON_TEXT_MIN],
  ['focus', 'surface', NON_TEXT_MIN],
  ['warning', 'surface', TEXT_MIN],
  ['danger', 'surface', TEXT_MIN],
];

function rawDeclaration(css: string, name: string): string | undefined {
  const matches = [...css.matchAll(new RegExp(`--color-${name}:\\s*([^;]+);`, 'g'))];
  return matches.at(-1)?.[1]?.trim();
}

function luminance(hex: string): number {
  const digits = hex.replace('#', '').slice(0, 6);
  return CHANNEL_WEIGHTS.reduce((sum, weight, i) => {
    const s = Number.parseInt(digits.slice(i * 2, i * 2 + 2), 16) / 255;
    const lin = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    return sum + lin * weight;
  }, 0);
}

function ratio(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('role tokens', () => {
  const colors = parseThemeColors(THEME_CSS);

  it.each(ROLES)('--color-%s exists and aliases a primitive token', (role) => {
    const value = rawDeclaration(THEME_CSS, role);
    expect(value, `--color-${role} missing from theme.css`).toBeDefined();
    expect(value).toMatch(PRIMITIVE_REFERENCE);
  });

  it.each(ROLES)('--color-%s is remapped for print', (role) => {
    expect(rawDeclaration(PRINT_CSS, role), `--color-${role} missing from print.css`).toBeDefined();
  });

  it.each(ROLE_PAIRS)('%s on %s meets %s:1', (fg, bg, min) => {
    const foreground = colors[fg] ?? '';
    const background = colors[bg] ?? '';
    expect(foreground).toMatch(/^#/);
    expect(background).toMatch(/^#/);
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(min);
  });

  it('the contrast script audits every role pair', () => {
    const out = execFileSync('node', [CONTRAST_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
    for (const [fg, bg] of ROLE_PAIRS) {
      expect(out).toContain(`role ${fg} on ${bg}`);
    }
  });
});
