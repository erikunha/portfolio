import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listFiles } from '../lib/walk';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;

const SCRIPTS_DIR = join(process.cwd(), 'scripts');
const SCRIPT_FILE = /\.(mjs|ts)$/;
const TS_SCRIPT_FILE = /\.ts$/;
const ARGV_ENTRY_GUARD = /process\.argv\[1\]/;
const SHARED_GUARD_IMPORT = /from '(\.\/|\.\.\/)lib\/is-main(\.ts)?'/;
const GUARD_HELPER = 'lib/is-main.ts';
const NOT_SCRIPTS: ReadonlySet<string> = new Set(['__tests__', 'fixtures', 'node_modules']);
const scriptsMatching = (pattern: RegExp): string[] =>
  listFiles(SCRIPTS_DIR, { include: pattern, skipDirs: NOT_SCRIPTS }).filter(
    (path) => path !== GUARD_HELPER,
  );
const UNRESOLVED_MAIN_GUARD = 'pathToFileURL(process.argv[1])';
const TSX = join(process.cwd(), 'node_modules/.bin/tsx');

describe('script entry guards', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('resolve symlinks before comparing argv[1] with import.meta.url', () => {
    const offenders = scriptsMatching(SCRIPT_FILE).filter((name) =>
      readFileSync(join(SCRIPTS_DIR, name), 'utf8').includes(UNRESOLVED_MAIN_GUARD),
    );

    expect(
      offenders,
      'Node resolves the symlink behind a main module for import.meta.url but leaves process.argv[1] as typed, so the two never match and the script exits 0 without running. Wrap argv[1] in realpathSync.',
    ).toEqual([]);
  });

  it('has every .ts script import isMain instead of defining its own argv[1] guard', () => {
    const offenders = scriptsMatching(TS_SCRIPT_FILE).filter((name) => {
      const source = readFileSync(join(SCRIPTS_DIR, name), 'utf8');
      return ARGV_ENTRY_GUARD.test(source) && !SHARED_GUARD_IMPORT.test(source);
    });

    expect(
      offenders,
      'A .ts script under scripts/ (any depth) that compares process.argv[1] with import.meta.url must import isMain from scripts/lib/is-main so every script resolves symlinks the same way.',
    ).toEqual([]);
  });

  it('runs lint-css-tokens when it is started through a symlink', () => {
    const link = join(mkdtempSync(join(tmpdir(), 'css-tokens-')), 'linked-lint.ts');
    symlinkSync(join(SCRIPTS_DIR, 'gates', 'lint-css-tokens.ts'), link);

    const out = execFileSync(TSX, [link], { encoding: 'utf8', stdio: 'pipe' });

    expect(out).toContain('[css-tokens]');
  });
});
