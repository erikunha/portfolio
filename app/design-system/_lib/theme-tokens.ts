import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function parseThemeColors(css: string): Record<string, string> {
  const colors: Record<string, string> = {};
  const re = /--color-([\w-]+):\s*([^;]+);/g;
  for (const [, name, value] of css.matchAll(re)) {
    if (name && value) colors[name.trim()] = value.trim();
  }
  return colors;
}

let cache: Record<string, string> | null = null;

export function getThemeColors(): Record<string, string> {
  if (!cache) {
    const css = readFileSync(join(process.cwd(), 'app/css/theme.css'), 'utf8');
    cache = parseThemeColors(css);
  }
  return cache;
}
