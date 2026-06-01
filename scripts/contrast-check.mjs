#!/usr/bin/env node
// Verifies WCAG AA contrast. Parses color values from app/css/theme.css @theme block.
// No hardcoded values — the @theme block is the single source of truth.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const themeCss = readFileSync(resolve(__dirname, '../app/css/theme.css'), 'utf8');

function parseThemeColors(css) {
  const colors = {};
  const re = /--color-([\w-]+):\s*([^;]+);/g;
  for (const [, name, value] of css.matchAll(re)) {
    colors[name.trim()] = value.trim();
  }
  return colors;
}

function hexToRgb(hex) {
  // Handle 8-digit hex (RGBA) by stripping alpha
  const h = hex.replace('#', '').slice(0, 6);
  const len = h.length === 3 ? 1 : 2;
  return [0, 1, 2].map((i) =>
    parseInt(h.substring(i * len, i * len + len).padEnd(2, h[i * len]), 16),
  );
}

function parseColor(value) {
  // Handle hex
  if (value.startsWith('#')) return hexToRgb(value);
  // Handle rgba()
  const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

function relativeLuminance([r, g, b]) {
  return [r, g, b].reduce((sum, c, i) => {
    const s = c / 255;
    const lin = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    return sum + lin * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function contrastRatio(c1, c2) {
  const L1 = relativeLuminance(c1);
  const L2 = relativeLuminance(c2);
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

const theme = parseThemeColors(themeCss);

function get(name) {
  const val = theme[name];
  if (!val) throw new Error(`--color-${name} not found in app/css/theme.css`);
  const rgb = parseColor(val);
  if (!rgb) throw new Error(`Cannot parse --color-${name}: ${val}`);
  return rgb;
}

// Pairs: [fg token name, bg token name, minRatio, label]
const PAIRS = [
  ['primary-400', 'secondary-950', 4.5, 'muted text on base'],
  ['primary-300', 'secondary-950', 4.5, 'faint text on base'],
  ['primary-500', 'secondary-950', 3.0, 'signal on base (large text)'],
  ['tertiary-50', 'secondary-900', 4.5, 'body text on shell'],
  ['primary-500', 'secondary-900', 3.0, 'signal on shell (large text)'],
];

let failures = 0;
for (const [fg, bg, minRatio, label] of PAIRS) {
  try {
    const ratio = contrastRatio(get(fg), get(bg));
    const pass = ratio >= minRatio;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${ratio.toFixed(2)}:1 (min ${minRatio}:1)`);
    if (!pass) failures++;
  } catch (err) {
    console.error(`ERROR ${label}: ${err.message}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} contrast failure(s).`);
  process.exit(1);
}
console.log('\nContrast check passed.');
