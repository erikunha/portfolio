import { execFile } from 'node:child_process';

export function listDir(dir: string): void {
  execFile('ls', [dir], () => undefined);
}
