import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import strykerConfig from '../stryker.config.mjs';

const SYMLINK_MODE = '120000';
const ROOT = process.cwd();

function trackedDirectorySymlinks(): string[] {
  const listing = execFileSync('git', ['ls-files', '-s', '-z'], { cwd: ROOT, encoding: 'utf8' });
  return listing
    .split('\0')
    .filter((entry) => entry.startsWith(`${SYMLINK_MODE} `))
    .map((entry) => entry.slice(entry.indexOf('\t') + 1))
    .filter((path) => statSync(join(ROOT, path)).isDirectory());
}

describe('stryker sandbox copy', () => {
  it('ignores every tracked symlink that points at a directory, since the sandbox copies each file and a directory target fails with EISDIR before any mutant runs', () => {
    const ignorePatterns = (strykerConfig.ignorePatterns ?? []) as string[];
    const uncovered = trackedDirectorySymlinks().filter(
      (path) =>
        !ignorePatterns.some((pattern) => path === pattern || path.startsWith(`${pattern}/`)),
    );

    expect(uncovered).toEqual([]);
  });
});
