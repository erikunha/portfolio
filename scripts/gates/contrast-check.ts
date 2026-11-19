import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseThemeColors } from '../../app/(en)/design-system/_lib/theme-tokens.ts';
import { isMain } from '../lib/is-main.ts';

type Rgb = [number, number, number];
type Pair = [fg: string, bg: string, minRatio: number, label: string];

const ARGV_OFFSET = 2;
const SHORT_HEX_LENGTH = 3;
const HEX_DIGITS_PER_CHANNEL = 2;
const HEX_RADIX = 16;
const HEX_BODY_LENGTH = 6;
const CHANNEL_MAX = 255;
const SRGB_LINEAR_CUTOFF = 0.04045;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_OFFSET = 0.055;
const SRGB_SCALE = 1.055;
const SRGB_GAMMA = 2.4;
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722];
const LUMINANCE_FLARE = 0.05;
const RATIO_DECIMALS = 2;
const FAILURE_EXIT_CODE = 1;
const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3.0;
const DEFAULT_THEME_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../app/css/theme.css',
);
const RGB_FUNCTION = /rgba?\((\d+),\s*(\d+),\s*(\d+)/;

const PAIRS: Pair[] = [
  ['text', 'secondary-950', 4.5, 'semantic body text on base'],
  ['text', 'secondary-900', 4.5, 'semantic body text on shell'],
  ['text-secondary', 'secondary-950', 4.5, 'semantic secondary text on base'],
  ['text-secondary', 'secondary-900', 4.5, 'semantic secondary text on shell'],
  ['primary-400', 'secondary-950', 4.5, 'muted text on base'],
  ['primary-700', 'secondary-950', 4.5, 'site map links on base'],
  ['primary-700', 'secondary-900', 4.5, 'site map links on card'],
  ['primary-300', 'secondary-950', 4.5, 'faint text on base'],
  ['tertiary-50', 'secondary-950', 4.5, 'tertiary-50 foreground title text on base'],
  ['primary-500', 'secondary-950', 3.0, 'signal on base (large text)'],
  ['tertiary-50', 'secondary-900', 4.5, 'body text on shell'],
  ['tertiary-500', 'secondary-950', 4.5, 'form placeholder on base'],
  ['primary-500', 'secondary-900', 3.0, 'signal on shell (large text)'],
  ['tertiary-400', 'secondary-950', 4.5, 'tertiary-400 meta text on base (/links)'],
  ['senary-300', 'secondary-950', 4.5, 'alert text on base (errors, clip LED)'],
];

const ROLE_PAIRS: Pair[] = (
  [
    ['text', 'surface', TEXT_MIN],
    ['text-muted', 'surface', TEXT_MIN],
    ['on-accent', 'accent', TEXT_MIN],
    ['accent', 'surface', NON_TEXT_MIN],
    ['focus', 'surface', NON_TEXT_MIN],
    ['warning', 'surface', TEXT_MIN],
    ['danger', 'surface', TEXT_MIN],
  ] as [string, string, number][]
).map(([fg, bg, min]) => [fg, bg, min, `role ${fg} on ${bg}`]);

const ROLE_NAMES = [
  'surface',
  'surface-raised',
  'border',
  'border-strong',
  'accent',
  'on-accent',
  'text-muted',
  'focus',
  'warning',
  'danger',
  'scrim',
];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '').slice(0, HEX_BODY_LENGTH);
  const len = h.length === SHORT_HEX_LENGTH ? 1 : HEX_DIGITS_PER_CHANNEL;
  const channel = (i: number): number =>
    Number.parseInt(
      h.substring(i * len, i * len + len).padEnd(HEX_DIGITS_PER_CHANNEL, h[i * len]),
      HEX_RADIX,
    );
  return [channel(0), channel(1), channel(2)];
}

function parseColor(value: string): Rgb | null {
  if (value.startsWith('#')) return hexToRgb(value);
  const m = value.match(RGB_FUNCTION);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

function relativeLuminance(rgb: Rgb): number {
  return rgb.reduce((sum, c, i) => {
    const s = c / CHANNEL_MAX;
    const lin =
      s <= SRGB_LINEAR_CUTOFF
        ? s / SRGB_LINEAR_DIVISOR
        : ((s + SRGB_OFFSET) / SRGB_SCALE) ** SRGB_GAMMA;
    return sum + lin * (LUMINANCE_WEIGHTS[i] ?? 0);
  }, 0);
}

function contrastRatio(c1: Rgb, c2: Rgb): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + LUMINANCE_FLARE) / (dark + LUMINANCE_FLARE);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function main(themePath: string | undefined): number {
  const theme = parseThemeColors(readFileSync(themePath ?? DEFAULT_THEME_PATH, 'utf8'));

  const get = (name: string): Rgb => {
    const val = theme[name];
    if (!val) throw new Error(`--color-${name} not found in app/css/theme.css`);
    const rgb = parseColor(val);
    if (!rgb) throw new Error(`Cannot parse --color-${name}: ${val}`);
    return rgb;
  };

  const auditRoles = themePath === undefined || ROLE_NAMES.some((name) => name in theme);

  let failures = 0;
  if (auditRoles) {
    for (const name of ROLE_NAMES) {
      if (name in theme) continue;
      console.error(`ERROR role token --color-${name} not declared`);
      failures++;
    }
  }
  for (const [fg, bg, minRatio, label] of auditRoles ? [...PAIRS, ...ROLE_PAIRS] : PAIRS) {
    try {
      const ratio = contrastRatio(get(fg), get(bg));
      const pass = ratio >= minRatio;
      console.log(
        `${pass ? 'PASS' : 'FAIL'} ${label}: ${ratio.toFixed(RATIO_DECIMALS)}:1 (min ${minRatio}:1)`,
      );
      if (!pass) failures++;
    } catch (err) {
      console.error(`ERROR ${label}: ${errorMessage(err)}`);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} contrast failure(s).`);
    return FAILURE_EXIT_CODE;
  }
  console.log('\nContrast check passed.');
  return 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv[ARGV_OFFSET]));
