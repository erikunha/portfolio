import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const CSS_DIR = path.resolve(__dirname, '../../app/css');
const PARTIAL = /^components-.+\.css$/;

export function componentsCssFiles(): string[] {
  return readdirSync(CSS_DIR)
    .filter((f) => PARTIAL.test(f))
    .sort();
}

export function readComponentsCss(): string {
  // behavioral-test-allow: reads the shipped stylesheet partials; jsdom cannot evaluate CSS cascade/media-query resolution
  return componentsCssFiles()
    .map((f) => readFileSync(path.join(CSS_DIR, f), 'utf-8'))
    .join('\n');
}
