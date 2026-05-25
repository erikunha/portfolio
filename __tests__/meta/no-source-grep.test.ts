// __tests__/meta/no-source-grep.test.ts
// Best-effort guard for the Testing standard: a test should not assert
// application SOURCE text. It flags a readFileSync / readFile() of a file
// under app/ components/ lib/ scripts/ unless the line carries an explicit
// allow tag:
//   // behavioral-test-allow: <reason>
// Fixture reads (under __tests__/**/fixtures/) are always permitted.
//
// This is a lint, not airtight enforcement. It is a line-level regex scan, so
// it will MISS aliased imports (`import { readFileSync as r }`), the
// fs.promises API, dynamically built paths, and any read split across lines.
// It catches the common, copy-pasted shape — treat a clean run as a smoke
// signal, not a proof that no test couples to source.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = process.cwd();
const SCAN_DIRS = ['__tests__', 'components', 'lib', 'app', 'design-system'].map((d) =>
  join(ROOT_DIR, d),
);
const SOURCE_HINT = /readFileSync|readFile\(/;
// Matches a quoted path literal whose segments include app/ components/ lib/
// scripts/ — whether the segment is at the literal's start (`'app/x'`) or
// after a relative prefix (`'./app/x'`, `'../lib/y'`).
const TARGETS_APP_SOURCE = /['"`](?:[^'"`]*\/)?(app|components|lib|scripts)\//;
const ALLOW_TAG = /behavioral-test-allow:/;

const SKIP_DIRS = new Set(['node_modules', '.next', 'coverage', 'dist', '.claude']);

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
      lines.forEach((line, i) => {
        if (!SOURCE_HINT.test(line)) return;
        if (!TARGETS_APP_SOURCE.test(line)) return; // fixture / config path
        if (ALLOW_TAG.test(line) || ALLOW_TAG.test(lines[i - 1] ?? '')) return;
        violations.push(`${file}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(violations, `source-grep test assertions:\n${violations.join('\n')}`).toEqual([]);
  });
});
