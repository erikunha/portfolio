import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listFiles } from '@/scripts/lib/walk';

const ROOTS = ['__tests__', 'scripts/__tests__', 'lib', 'components'];
const SKIP_DIRS: ReadonlySet<string> = new Set(['node_modules', 'fixtures']);
const TEST_FILE = /\.test\.(ts|tsx|mjs)$/;
const SPAWNS_A_RUNTIME =
  /(execFileSync|spawnSync|execSync|spawn|execFile)\(\s*(process\.execPath|TSX\b|['"]tsx['"]|['"]node['"])/;
const DECLARES_TIMEOUT = /\btimeout\b/;

function offenders(): string[] {
  const files = new Set<string>();
  for (const root of ROOTS) {
    for (const path of listFiles(join(process.cwd(), root), {
      include: TEST_FILE,
      skipDirs: SKIP_DIRS,
    })) {
      files.add(`${root}/${path}`);
    }
  }
  return [...files].sort().filter((path) => {
    const text = readFileSync(join(process.cwd(), path), 'utf8');
    return SPAWNS_A_RUNTIME.test(text) && !DECLARES_TIMEOUT.test(text);
  });
}

describe('tests that start a node or tsx process', () => {
  it('declare a timeout, because a cold tsx start under a loaded machine passes the 5 s default', () => {
    expect(
      offenders(),
      'a node or tsx child takes about 2 s alone and more when other suites run at once; declare SUBPROCESS_TEST_TIMEOUT_MS on the describe (see scripts/__tests__/check-no-dashes.test.ts)',
    ).toEqual([]);
  });
});
