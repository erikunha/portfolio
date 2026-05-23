#!/usr/bin/env node
// Verifies WCAG AA contrast for defined semantic token pairs.
// Reads resolved values from design-system/dist/tokens.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(path.join(ROOT, 'design-system/dist/tokens.json'), 'utf8'));

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const len = h.length === 3 ? 1 : 2;
  return [0, 1, 2].map((i) =>
    parseInt(h.substring(i * len, i * len + len).padEnd(2, h[i * len]), 16),
  );
}

function relativeLuminance([r, g, b]) {
  return [r, g, b].reduce((sum, c, i) => {
    const s = c / 255;
    const lin = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    return sum + lin * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function contrastRatio(hex1, hex2) {
  const L1 = relativeLuminance(hexToRgb(hex1));
  const L2 = relativeLuminance(hexToRgb(hex2));
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

function resolveToken(name) {
  // tokens.json has PascalCase keys without -- (e.g. DsColorTextBody)
  return tokens[name];
}

// Pairs: [foreground token, background token, min ratio, label]
const PAIRS = [
  ['DsColorTextBody', 'DsColorSurfaceBase', 4.5, 'body text on base'],
  ['DsColorTextMuted', 'DsColorSurfaceBase', 4.5, 'muted text on base'],
  ['DsColorTextFaint', 'DsColorSurfaceBase', 4.5, 'faint text on base'],
  ['DsColorSignal', 'DsColorSurfaceBase', 3.0, 'signal on base (large text)'],
  ['DsColorTextBody', 'DsColorSurfaceShell', 4.5, 'body text on shell'],
  ['DsColorSignal', 'DsColorSurfaceShell', 3.0, 'signal on shell (large text)'],
];

let failures = 0;
for (const [fg, bg, minRatio, label] of PAIRS) {
  const fgVal = resolveToken(fg);
  const bgVal = resolveToken(bg);
  if (!fgVal || !bgVal) {
    console.error(`MISSING TOKEN: ${fg} or ${bg}`);
    failures++;
    continue;
  }
  // Skip rgba values (can't compute without blending — rgba tokens are for non-text uses)
  if (fgVal.startsWith('rgba') || bgVal.startsWith('rgba')) {
    console.log(`SKIP: ${label} — rgba token (${fgVal} / ${bgVal})`);
    continue;
  }
  // Also check for hex values that have 8 chars (rgba in hex format like #00ff4166)
  if (
    (fgVal.length === 9 && fgVal.startsWith('#')) ||
    (bgVal.length === 9 && bgVal.startsWith('#'))
  ) {
    console.log(`SKIP: ${label} — hex-rgba token (${fgVal} / ${bgVal})`);
    continue;
  }
  const ratio = contrastRatio(fgVal, bgVal);
  const pass = ratio >= minRatio;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${ratio.toFixed(2)}:1 (min ${minRatio}:1)`);
  if (!pass) failures++;
}

if (failures > 0) {
  console.error(`\n${failures} contrast failure(s).`);
  process.exit(1);
}
console.log('\nContrast check passed.');
