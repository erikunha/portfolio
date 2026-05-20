// __tests__/meta/no-source-grep.test.ts
// Enforces the Testing standard: a test must not assert application SOURCE
// text. readFileSync of a file under app/ components/ lib/ scripts/ is a
// violation unless the line carries an explicit allow tag:
//   // behavioral-test-allow: <reason>
// Fixture reads (under __tests__/**/fixtures/) are always permitted.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const TESTS_DIR = join(process.cwd(), '__tests__');
const SOURCE_HINT = /readFileSync|readFile\(/;
const TARGETS_APP_SOURCE = /['"`][^'"`]*(?:^|\/)(app|components|lib|scripts)\//;
const ALLOW_TAG = /behavioral-test-allow:/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.test\.ts$/.test(e) ? [full] : [];
  });
}

describe('meta: tests assert behavior, not source', () => {
  it('no test reads application source for a structural assertion', () => {
    const violations: string[] = [];
    for (const file of walk(TESTS_DIR)) {
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
