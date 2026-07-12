import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = process.cwd();
const SCAN_DIRS = ['__tests__', 'components', 'lib', 'app', 'design-system'].map((d) =>
  join(ROOT_DIR, d),
);
const SOURCE_HINT = /readFileSync|readFile\(/;
const TARGETS_APP_SOURCE = /['"`](?:[^'"`]*\/)?(app|components|lib|scripts)\//;
const ALLOW_TAG = /behavioral-test-allow:/;

const SKIP_DIRS = new Set(['node_modules', '.next', 'coverage', 'dist', '.claude']);
function commentLineMap(lines: string[]): boolean[] {
  let inBlock = false;
  return lines.map((line) => {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes('*/')) inBlock = false;
      return true;
    }
    if (trimmed.startsWith('//')) return true;
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlock = true;
      return true;
    }
    return false;
  });
}

function isAllowTagged(lines: string[], isComment: boolean[], index: number): boolean {
  if (ALLOW_TAG.test(lines[index] ?? '')) return true;
  for (let i = index - 1; i >= 0 && isComment[i]; i--) {
    if (ALLOW_TAG.test(lines[i] ?? '')) return true;
  }
  return false;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    if (SKIP_DIRS.has(e)) return [];
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.test\.tsx?$/.test(e) ? [full] : [];
  });
}

describe('meta: tests assert behavior, not source', () => {
  it('no test reads application source for a structural assertion', () => {
    const violations: string[] = [];
    for (const file of SCAN_DIRS.flatMap(walk)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      const isComment = commentLineMap(lines);
      lines.forEach((line, i) => {
        if (!SOURCE_HINT.test(line)) return;
        if (!TARGETS_APP_SOURCE.test(line)) return;
        if (isAllowTagged(lines, isComment, i)) return;
        violations.push(`${file}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(violations, `source-grep test assertions:\n${violations.join('\n')}`).toEqual([]);
  });
});
