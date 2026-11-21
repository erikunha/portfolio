import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listFiles } from '@/scripts/lib/walk';

const ROOTS = ['__tests__', 'scripts', 'tests'];
const SKIP_DIRS: ReadonlySet<string> = new Set(['node_modules', 'fixtures']);
const SOURCE_FILE = /\.(ts|tsx|mjs)$/;
const WHOLE_HISTORY_READ = /['"]rev-list['"][^)]*['"]--all['"]/s;
const MAX_BUFFER_OPTION = /\bmaxBuffer\b/;
const SELF = '__tests__/meta/git-history-max-buffer.test.ts';

function offenders(): string[] {
  return ROOTS.flatMap((root) =>
    listFiles(join(process.cwd(), root), { include: SOURCE_FILE, skipDirs: SKIP_DIRS }).map(
      (path) => `${root}/${path}`,
    ),
  )
    .filter((path) => path !== SELF)
    .filter((path) => {
      const text = readFileSync(join(process.cwd(), path), 'utf8');
      return WHOLE_HISTORY_READ.test(text) && !MAX_BUFFER_OPTION.test(text);
    });
}

describe('whole-history git reads', () => {
  it('set maxBuffer, because rev-list --all outgrows the 1 MiB spawnSync default', () => {
    expect(
      offenders(),
      'git rev-list --all prints every object of every ref; once the repository passes 1 MiB of object lines, spawnSync stops it with ENOBUFS and status null. Pass maxBuffer: GIT_MAX_BUFFER_BYTES from scripts/lib/git.ts.',
    ).toEqual([]);
  });
});
