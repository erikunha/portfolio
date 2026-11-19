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

export type ThemeTokenScope = 'theme' | 'root';

export type ThemeToken = {
  name: string;
  value: string;
  scope: ThemeTokenScope;
  minWidth?: string;
};

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const WHITESPACE_RUN = /\s+/g;
const THEME_HEADER = '@theme';
const ROOT_HEADER = ':root';
const BASE_LAYER_HEADER = '@layer base';
const SUPPORTS_PREFIX = '@supports';
const MIN_WIDTH_QUERY = /^@media \(min-width:\s*([^)]+)\)$/;
const CUSTOM_PROPERTY_PREFIX = '--';
const DECLARATION_SEPARATOR = ':';

function scopeOf(headers: string[]): { scope: ThemeTokenScope; minWidth?: string } | undefined {
  if (headers.some((header) => header.startsWith(SUPPORTS_PREFIX))) return undefined;
  const [first, second, third] = headers;
  if (headers.length === 1 && first === THEME_HEADER) return { scope: 'theme' };
  if (first !== BASE_LAYER_HEADER) return undefined;
  if (headers.length === 2 && second === ROOT_HEADER) return { scope: 'root' };
  const minWidth = second?.match(MIN_WIDTH_QUERY)?.[1]?.trim();
  if (headers.length === 3 && minWidth !== undefined && third === ROOT_HEADER) {
    return { scope: 'root', minWidth };
  }
  return undefined;
}

export function parseThemeTokens(css: string): ThemeToken[] {
  const tokens: ThemeToken[] = [];
  const headers: string[] = [];
  let buffer = '';
  for (const char of css.replace(BLOCK_COMMENT, '')) {
    if (char === '{') {
      headers.push(buffer.replace(WHITESPACE_RUN, ' ').trim());
      buffer = '';
    } else if (char === '}') {
      headers.pop();
      buffer = '';
    } else if (char === ';') {
      const separator = buffer.indexOf(DECLARATION_SEPARATOR);
      const name = buffer.slice(0, separator).trim();
      const scope = scopeOf(headers);
      if (scope && separator > 0 && name.startsWith(CUSTOM_PROPERTY_PREFIX)) {
        const value = buffer
          .slice(separator + 1)
          .replace(WHITESPACE_RUN, ' ')
          .trim();
        tokens.push({ name, value, ...scope });
      }
      buffer = '';
    } else {
      buffer += char;
    }
  }
  return tokens;
}

const REM_PX = 16;
const LENGTH_VALUE = /^(-?[\d.]+)(rem|px)?$/;
const VAR_VALUE = /^var\((--[\w-]+)\)$/;
const PRODUCT_VALUE = /^calc\((.+) \* (.+)\)$/;
const PIXEL_DECIMALS = 2;
const MAX_ALIAS_DEPTH = 8;

type Measure = { amount: number; length: boolean };

function measure(value: string, tokens: readonly ThemeToken[], depth = 0): Measure | undefined {
  if (depth > MAX_ALIAS_DEPTH) return undefined;
  const alias = value.match(VAR_VALUE)?.[1];
  if (alias !== undefined) {
    const target = tokens.find((token) => token.name === alias && token.minWidth === undefined);
    return target ? measure(target.value, tokens, depth + 1) : undefined;
  }
  const product = value.match(PRODUCT_VALUE);
  if (product) {
    const left = measure(product[1] ?? '', tokens, depth + 1);
    const right = measure(product[2] ?? '', tokens, depth + 1);
    if (!left || !right || (left.length && right.length)) return undefined;
    return { amount: left.amount * right.amount, length: left.length || right.length };
  }
  const literal = value.match(LENGTH_VALUE);
  if (!literal) return undefined;
  const amount = Number(literal[1]);
  if (literal[2] === 'rem') return { amount: amount * REM_PX, length: true };
  return { amount, length: literal[2] === 'px' };
}

export function resolveTokenPixels(
  token: Pick<ThemeToken, 'value'>,
  tokens: readonly ThemeToken[],
): number | undefined {
  const result = measure(token.value, tokens);
  return result?.length ? result.amount : undefined;
}

export function formatPixels(pixels: number): string {
  return `${Number(pixels.toFixed(PIXEL_DECIMALS))}px`;
}

export function displayTokenValue(
  token: Pick<ThemeToken, 'value'>,
  tokens: readonly ThemeToken[],
): string {
  const pixels = resolveTokenPixels(token, tokens);
  return pixels === undefined ? token.value : formatPixels(pixels);
}

export function aliasTarget(token: Pick<ThemeToken, 'value'>, prefix: string): string | undefined {
  const target = token.value.match(VAR_VALUE)?.[1];
  return target?.startsWith(prefix) ? target.slice(prefix.length) : undefined;
}

export function tokensWithPrefix(
  tokens: readonly ThemeToken[],
  prefix: string,
  scope?: ThemeTokenScope,
): ThemeToken[] {
  const full = `${CUSTOM_PROPERTY_PREFIX}${prefix}`;
  return tokens.filter(
    (token) =>
      token.name.startsWith(full) &&
      token.minWidth === undefined &&
      (scope === undefined || token.scope === scope),
  );
}

let tokenCache: ThemeToken[] | null = null;

export function getThemeTokens(): ThemeToken[] {
  if (!tokenCache) {
    tokenCache = parseThemeTokens(readFileSync(join(process.cwd(), 'app/css/theme.css'), 'utf8'));
  }
  return tokenCache;
}
