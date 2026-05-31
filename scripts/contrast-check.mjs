#!/usr/bin/env node
// Verifies WCAG AA contrast for defined semantic token pairs.
// Values sourced from app/css/theme.css @theme block (canonical source after Tailwind migration).

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

// Resolved values from @theme (app/css/theme.css).
// Update here whenever @theme values change.
const COLORS = {
  signal: '#00ff41',
  textBody: '#e6ffe6',
  textMuted: '#4ade80',
  textFaint: '#5ae07b',
  surface: '#000000',
  surfaceShell: '#050505',
};

// Pairs: [foreground, background, minRatio, label]
const PAIRS = [
  [COLORS.textMuted, COLORS.surface, 4.5, 'muted text on base'],
  [COLORS.textFaint, COLORS.surface, 4.5, 'faint text on base'],
  [COLORS.signal, COLORS.surface, 3.0, 'signal on base (large text)'],
  [COLORS.textBody, COLORS.surfaceShell, 4.5, 'body text on shell'],
  [COLORS.signal, COLORS.surfaceShell, 3.0, 'signal on shell (large text)'],
];

let failures = 0;
for (const [fg, bg, minRatio, label] of PAIRS) {
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= minRatio;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${ratio.toFixed(2)}:1 (min ${minRatio}:1)`);
  if (!pass) failures++;
}

if (failures > 0) {
  console.error(`\n${failures} contrast failure(s).`);
  process.exit(1);
}
console.log('\nContrast check passed.');
