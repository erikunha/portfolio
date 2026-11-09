import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const CSS_DIR = path.resolve(__dirname, '../../app/css');
const GLOBALS_CSS = path.resolve(__dirname, '../../app/globals.css');
const PARTIAL = /^components-.+\.css$/;
const PARTIAL_IMPORT = /@import\s+"\.\/css\/(components-[^"]+\.css)";/g;
const BASE_CSS = 'base.css';

export function componentsCssFiles(): string[] {
  // behavioral-test-allow: reads the shipped stylesheet entrypoint; jsdom cannot evaluate CSS cascade order
  const globals = readFileSync(GLOBALS_CSS, 'utf-8');
  const imported = Array.from(globals.matchAll(PARTIAL_IMPORT), (m) => m[1] ?? '');
  const onDisk = readdirSync(CSS_DIR).filter((f) => PARTIAL.test(f));
  const unimported = onDisk.filter((f) => !imported.includes(f));
  if (unimported.length > 0) {
    throw new Error(
      `app/globals.css does not import these app/css partials: ${unimported.join(', ')}. ` +
        'An unimported partial is never shipped, so a stylesheet assertion that reads it ' +
        'would pass against CSS the browser never loads.',
    );
  }
  return imported;
}

export function readComponentsCssRaw(): string {
  // behavioral-test-allow: reads the shipped stylesheet partials; jsdom cannot evaluate CSS cascade/media-query resolution
  return componentsCssFiles()
    .map((f) => readFileSync(path.join(CSS_DIR, f), 'utf-8'))
    .join('\n');
}

export function readComponentsCss(): string {
  return resolveViewportTokens(readComponentsCssRaw());
}

export function readBaseCssRaw(): string {
  // behavioral-test-allow: reads the shipped stylesheet entrypoint; jsdom cannot evaluate CSS cascade order
  const globals = readFileSync(GLOBALS_CSS, 'utf-8');
  if (!globals.includes(`./css/${BASE_CSS}`)) {
    throw new Error(
      `app/globals.css does not import app/css/${BASE_CSS}. An unimported partial is never shipped, ` +
        'so a stylesheet assertion that reads it would pass against CSS the browser never loads.',
    );
  }
  // behavioral-test-allow: reads the shipped stylesheet partial; jsdom cannot evaluate CSS cascade/media-query resolution
  return readFileSync(path.join(CSS_DIR, BASE_CSS), 'utf-8');
}

export function readBaseCss(): string {
  return resolveViewportTokens(readBaseCssRaw());
}

const THEME_CSS = path.join(CSS_DIR, 'theme.css');
const VIEWPORT_DECLARATION = /(--viewport-[\w-]+):\s*([\d.]+px);/g;
const VIEWPORT_REFERENCE = /theme\((--viewport-[\w-]+)\)/g;

export function readViewportTokens(): Record<string, string> {
  // behavioral-test-allow: reads the shipped token file; jsdom cannot evaluate media-query resolution
  const theme = readFileSync(THEME_CSS, 'utf-8');
  return Object.fromEntries(
    Array.from(theme.matchAll(VIEWPORT_DECLARATION), (m) => [m[1] ?? '', m[2] ?? '']),
  );
}

export function resolveViewportTokens(css: string): string {
  const tokens = readViewportTokens();
  return css.replace(VIEWPORT_REFERENCE, (reference, name: string) => {
    const value = tokens[name];
    if (value === undefined) throw new Error(`${reference} names a viewport token theme.css lacks`);
    return value;
  });
}
