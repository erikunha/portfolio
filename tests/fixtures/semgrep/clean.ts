// FIXTURE: clean equivalent. Must produce ZERO Semgrep findings.
import { execFile } from 'node:child_process';

export function listDir(dir: string): void {
  // execFile with an argv array — no shell, no string interpolation.
  execFile('ls', [dir], () => {});
}
