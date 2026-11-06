import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const COLOR_DECLARATION = /--color-([\w-]+):\s*([^;]+);/g;
const COLOR_ALIAS = /^var\(--color-([\w-]+)\)$/;

export function parseThemeColors(css: string): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(COLOR_DECLARATION)) {
    if (name && value) colors[name.trim()] = value.trim();
  }
  for (const [name, value] of Object.entries(colors)) {
    const target = value.match(COLOR_ALIAS)?.[1];
    const resolved = target === undefined ? undefined : colors[target];
    if (resolved !== undefined) colors[name] = resolved;
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
