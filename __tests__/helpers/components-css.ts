import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const CSS_DIR = path.resolve(__dirname, '../../app/css');
const GLOBALS_CSS = path.resolve(__dirname, '../../app/globals.css');
const PARTIAL = /^components-.+\.css$/;
const PARTIAL_IMPORT = /@import\s+"\.\/css\/(components-[^"]+\.css)";/g;

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

export function readComponentsCss(): string {
  // behavioral-test-allow: reads the shipped stylesheet partials; jsdom cannot evaluate CSS cascade/media-query resolution
  return componentsCssFiles()
    .map((f) => readFileSync(path.join(CSS_DIR, f), 'utf-8'))
    .join('\n');
}
