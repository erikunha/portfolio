import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

export const RUN_TMPDIR_PREFIX = 'portfolio-vitest-';

export default function setupRunTmpdir(): () => void {
  if (basename(tmpdir()).startsWith(RUN_TMPDIR_PREFIX)) return () => undefined;
  const previous = process.env.TMPDIR;
  const runDir = mkdtempSync(join(tmpdir(), RUN_TMPDIR_PREFIX));
  process.env.TMPDIR = runDir;
  return () => {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    rmSync(runDir, { recursive: true, force: true });
  };
}
