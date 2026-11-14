import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const RUN_TMPDIR_PREFIX = 'portfolio-vitest-';

export default function setupRunTmpdir(): () => void {
  const previous = process.env.TMPDIR;
  const runDir = mkdtempSync(join(tmpdir(), RUN_TMPDIR_PREFIX));
  process.env.TMPDIR = runDir;
  return () => {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    rmSync(runDir, { recursive: true, force: true });
  };
}
