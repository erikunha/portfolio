// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const SCANNED_DIRS = ['app', 'components', 'design-system'];
const SCANNED_EXTENSIONS = new Set(['.css', '.tsx', '.ts']);
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const RAW_MOTION_SELECTOR = /data-motion=["']?reduce/;
const VARIANT_DECLARATION = /^\s*@custom-variant\s/;
const THEME_CSS = path.join('app', 'css', 'theme.css');

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(relative);
    const scanned = SCANNED_EXTENSIONS.has(path.extname(entry.name)) && !TEST_FILE.test(entry.name);
    return scanned ? [relative] : [];
  });
}

function rawSelectorHits(): string[] {
  return SCANNED_DIRS.flatMap(sourceFiles).flatMap((file) =>
    readFileSync(path.join(ROOT, file), 'utf8')
      .split('\n')
      .flatMap((line, index) => {
        if (!RAW_MOTION_SELECTOR.test(line)) return [];
        if (file === THEME_CSS && VARIANT_DECLARATION.test(line)) return [];
        return [`${file}:${index + 1}`];
      }),
  );
}

describe('motion selector spelling', () => {
  it('spells every MOTION switch selector through a variant', () => {
    expect(rawSelectorHits()).toEqual([]);
  });
});
