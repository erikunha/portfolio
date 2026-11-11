import { execFile } from 'node:child_process';

// The remediation the rule names: an argv array, no shell string.
export function listDirectory(directory: string): void {
  execFile('ls', [directory], () => undefined);
}
