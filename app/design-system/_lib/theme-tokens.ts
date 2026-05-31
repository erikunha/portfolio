import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// theme.css (@theme) is the single source of truth for brand colour. This mirrors
// the regex in scripts/contrast-check.mjs so the docs and the contrast gate read
// identical values from the same file — no second catalog to drift.
export function parseThemeColors(css: string): Record<string, string> {
  const colors: Record<string, string> = {};
  const re = /--color-([\w-]+):\s*([^;]+);/g;
  for (const [, name, value] of css.matchAll(re)) {
    if (name && value) colors[name.trim()] = value.trim();
  }
  return colors;
}

let cache: Record<string, string> | null = null;

// Read at build time (these docs pages are SSG). process.cwd() is the repo root.
export function getThemeColors(): Record<string, string> {
  if (!cache) {
    const css = readFileSync(join(process.cwd(), 'app/css/theme.css'), 'utf8');
    cache = parseThemeColors(css);
  }
  return cache;
}
