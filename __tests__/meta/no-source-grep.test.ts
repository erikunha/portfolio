import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = process.cwd();
const SOURCE_HINT = /readFileSync|readFile\(/;
const TARGETS_APP_SOURCE = /['"`](?:[^'"`]*\/)?(app|components|lib|scripts)\//;
const ALLOW_TAG = /behavioral-test-allow:/;

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'coverage',
  'dist',
  '.claude',
  '.git',
  '.worktrees',
  '.stryker-tmp',
  'playwright-report',
  'test-results',
  'out',
  'build',
]);
const TEST_DIRS = new Set(['__tests__', 'tests']);
const TEST_FILE = /\.(test|spec|e2e)\.[cm]?[jt]sx?$/;
const ANY_SCRIPT = /\.[cm]?[jt]sx?$/;
const TYPE_DECL = /\.d\.ts$/;
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;
const IMPORT_LINE = /^\s*import\b/;
const CALL_LOOKAHEAD_LINES = 3;

const STRING_LITERAL = /(['"`])(?:\\.|(?!\1).)*?\1/g;
const LINE_COMMENT = /\/\/.*$/;

function parenBalance(line: string): number {
  const code = line.replace(STRING_LITERAL, '').replace(LINE_COMMENT, '');
  return (code.match(/\(/g) ?? []).length - (code.match(/\)/g) ?? []).length;
}

function callText(lines: string[], index: number): string {
  let text = lines[index] ?? '';
  let depth = parenBalance(text);
  for (let i = index + 1; depth > 0 && i <= index + CALL_LOOKAHEAD_LINES; i++) {
    const next = lines[i] ?? '';
    text += ` ${next}`;
    depth += parenBalance(next);
  }
  return text;
}

function isAllowTagged(lines: string[], index: number): boolean {
  if (ALLOW_TAG.test(lines[index] ?? '')) return true;
  for (let i = index - 1; i >= 0 && COMMENT_LINE.test(lines[i] ?? ''); i--) {
    if (ALLOW_TAG.test(lines[i] ?? '')) return true;
  }
  return false;
}

const isTestCode = (full: string, entry: string) => {
  if (TYPE_DECL.test(entry)) return false;
  const insideTestDir = full.split(sep).some((segment) => TEST_DIRS.has(segment));
  return insideTestDir ? ANY_SCRIPT.test(entry) : TEST_FILE.test(entry);
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    if (SKIP_DIRS.has(e)) return [];
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return walk(full);
    return isTestCode(full, e) ? [full] : [];
  });
}

describe('meta: tests assert behavior, not source', () => {
  it('no test reads application source for a structural assertion', () => {
    const violations: string[] = [];
    for (const file of walk(ROOT_DIR)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!SOURCE_HINT.test(line)) return;
        if (IMPORT_LINE.test(line)) return;
        if (!TARGETS_APP_SOURCE.test(callText(lines, i))) return;
        if (isAllowTagged(lines, i)) return;
        violations.push(`${file}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(violations, `source-grep test assertions:\n${violations.join('\n')}`).toEqual([]);
  });
});
