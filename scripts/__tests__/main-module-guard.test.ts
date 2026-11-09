import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPTS_DIR = join(process.cwd(), 'scripts');
const SCRIPT_FILE = /\.(mjs|ts)$/;
const UNRESOLVED_MAIN_GUARD = 'pathToFileURL(process.argv[1])';

describe('script entry guards', () => {
  it('resolve symlinks before comparing argv[1] with import.meta.url', () => {
    const offenders = readdirSync(SCRIPTS_DIR)
      .filter((name) => SCRIPT_FILE.test(name))
      .filter((name) =>
        readFileSync(join(SCRIPTS_DIR, name), 'utf8').includes(UNRESOLVED_MAIN_GUARD),
      );

    expect(
      offenders,
      'Node resolves the symlink behind a main module for import.meta.url but leaves process.argv[1] as typed, so the two never match and the script exits 0 without running. Wrap argv[1] in realpathSync.',
    ).toEqual([]);
  });
});
