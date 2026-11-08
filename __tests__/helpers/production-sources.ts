import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT_DIR = process.cwd();
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const NOT_PRODUCTION = /\.(test|spec|e2e)\.[cm]?[jt]sx?$|\/__tests__\//;

function walk(dir: string, into: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, into);
    else if (SOURCE_FILE.test(entry.name) && !NOT_PRODUCTION.test(path)) into.push(path);
  }
}

export function productionSources(roots: readonly string[]): Map<string, string> {
  const files: string[] = [];
  for (const root of roots) walk(join(ROOT_DIR, root), files);
  const sources = new Map<string, string>();
  for (const file of files) {
    // behavioral-test-allow: the source graph (who imports, who defines) is the property under test, not a render
    sources.set(relative(ROOT_DIR, file), readFileSync(file, 'utf-8'));
  }
  return sources;
}
